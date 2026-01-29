const express = require('express');
const router = express.Router();
const db = require('../config/database');

const VALID_PRIORITIES = new Set(['normal', 'urgent', 'vip']);
const VALID_STATUSES = new Set(['waiting', 'in_progress', 'completed', 'cancelled']);

// Get all tokens with filters
router.get('/', (req, res) => {
  const dbInstance = db.getDb();
  const { department_id, doctor_id, status, date } = req.query;
  
  let query = `
    SELECT t.*, p.name as patient_name, p.phone as patient_phone,
           d.name as doctor_name, dept.name as department_name
    FROM tokens t
    JOIN patients p ON t.patient_id = p.id
    JOIN doctors d ON t.doctor_id = d.id
    JOIN departments dept ON t.department_id = dept.id
    WHERE 1=1
  `;
  const params = [];

  if (department_id) {
    query += ' AND t.department_id = ?';
    params.push(department_id);
  }
  if (doctor_id) {
    query += ' AND t.doctor_id = ?';
    params.push(doctor_id);
  }
  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (date) {
    query += ' AND DATE(t.appointment_date) = DATE(?)';
    params.push(date);
  }

  query += ' ORDER BY t.appointment_date DESC, t.token_number ASC';

  dbInstance.all(query, params, (err, tokens) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(tokens);
  });
});

// Create new token
router.post('/', (req, res) => {
  const dbInstance = db.getDb();
  const { patient_id, doctor_id, department_id, priority, appointment_date } = req.body;
  
  if (!patient_id || !doctor_id || !department_id || !appointment_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const normalizedPriority = priority || 'normal';
  if (!VALID_PRIORITIES.has(normalizedPriority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  // Validate foreign keys & doctor-department relationship
  dbInstance.get('SELECT id FROM patients WHERE id = ?', [patient_id], (pErr, patient) => {
    if (pErr) return res.status(500).json({ error: 'Database error' });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    dbInstance.get(
      'SELECT id, department_id, is_active FROM doctors WHERE id = ?',
      [doctor_id],
      (dErr, doctor) => {
        if (dErr) return res.status(500).json({ error: 'Database error' });
        if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
        if (!doctor.is_active) return res.status(400).json({ error: 'Doctor is inactive' });
        if (Number(doctor.department_id) !== Number(department_id)) {
          return res.status(400).json({ error: 'Doctor does not belong to the department' });
        }

        // Concurrency-safe allocation:
        // - BEGIN IMMEDIATE acquires a write lock, so MAX(token_number)+1 is safe under concurrent requests
        // - Unique index enforces no duplicate tokens per (department, date, token_number)
        dbInstance.serialize(() => {
          dbInstance.run('BEGIN IMMEDIATE');

          dbInstance.run(
            `
            INSERT INTO tokens (token_number, patient_id, doctor_id, department_id, priority, appointment_date)
            SELECT COALESCE(MAX(token_number), 0) + 1, ?, ?, ?, ?, ?
            FROM tokens
            WHERE department_id = ? AND DATE(appointment_date) = DATE(?)
            `,
            [
              patient_id,
              doctor_id,
              department_id,
              normalizedPriority,
              appointment_date,
              department_id,
              appointment_date,
            ],
            function (insErr) {
              if (insErr) {
                dbInstance.run('ROLLBACK');
                return res.status(500).json({ error: 'Database error', details: insErr.message });
              }

              const createdId = this.lastID;
              dbInstance.run('COMMIT', (cErr) => {
                if (cErr) {
                  dbInstance.run('ROLLBACK');
                  return res.status(500).json({ error: 'Database error', details: cErr.message });
                }

                dbInstance.get(
                  `SELECT t.*, p.name as patient_name, p.phone as patient_phone,
                          d.name as doctor_name, dept.name as department_name
                   FROM tokens t
                   JOIN patients p ON t.patient_id = p.id
                   JOIN doctors d ON t.doctor_id = d.id
                   JOIN departments dept ON t.department_id = dept.id
                   WHERE t.id = ?`,
                  [createdId],
                  (gErr, token) => {
                    if (gErr) {
                      return res.status(500).json({ error: 'Database error' });
                    }

                    const io = req.app.get('io');
                    if (io) {
                      io.to(`department-${department_id}`).emit('token-updated', token);
                    }

                    res.status(201).json(token);
                  }
                );
              });
            }
          );
        });
      }
    );
  });
});

// Update token status
router.patch('/:id/status', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  const { status } = req.body;
  
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  let updateQuery = 'UPDATE tokens SET status = ?';
  const params = [status];

  if (status === 'in_progress') {
    updateQuery += ', called_at = CURRENT_TIMESTAMP';
  } else if (status === 'completed') {
    updateQuery += ', completed_at = CURRENT_TIMESTAMP';
  }

  updateQuery += ' WHERE id = ?';
  params.push(id);

  dbInstance.run(updateQuery, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    // Get updated token
    dbInstance.get(
      `SELECT t.*, p.name as patient_name, p.phone as patient_phone,
              d.name as doctor_name, dept.name as department_name
       FROM tokens t
       JOIN patients p ON t.patient_id = p.id
       JOIN doctors d ON t.doctor_id = d.id
       JOIN departments dept ON t.department_id = dept.id
       WHERE t.id = ?`,
      [id],
      (err, token) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
          io.to(`department-${token.department_id}`).emit('token-updated', token);
        }

        res.json(token);
      }
    );
  });
});

// Get current tokens for display board
router.get('/display/:departmentId', (req, res) => {
  const dbInstance = db.getDb();
  const { departmentId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  dbInstance.all(
    `SELECT t.*, p.name as patient_name,
            d.name as doctor_name
     FROM tokens t
     JOIN patients p ON t.patient_id = p.id
     JOIN doctors d ON t.doctor_id = d.id
     WHERE t.department_id = ? 
       AND DATE(t.appointment_date) = DATE(?)
       AND t.status IN ('waiting', 'in_progress')
     ORDER BY 
       CASE t.priority
         WHEN 'vip' THEN 1
         WHEN 'urgent' THEN 2
         ELSE 3
       END,
       t.token_number ASC
     LIMIT 20`,
    [departmentId, today],
    (err, tokens) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(tokens);
    }
  );
});

// Get next token to call
router.get('/next/:departmentId', (req, res) => {
  const dbInstance = db.getDb();
  const { departmentId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  dbInstance.get(
    `SELECT t.*, p.name as patient_name,
            d.name as doctor_name
     FROM tokens t
     JOIN patients p ON t.patient_id = p.id
     JOIN doctors d ON t.doctor_id = d.id
     WHERE t.department_id = ? 
       AND DATE(t.appointment_date) = DATE(?)
       AND t.status = 'waiting'
     ORDER BY 
       CASE t.priority
         WHEN 'vip' THEN 1
         WHEN 'urgent' THEN 2
         ELSE 3
       END,
       t.token_number ASC
     LIMIT 1`,
    [departmentId, today],
    (err, token) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(token || null);
    }
  );
});

// Get token by ID (keep AFTER /display and /next so it doesn't shadow them)
router.get('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  
  dbInstance.get(
    `SELECT t.*, p.name as patient_name, p.phone as patient_phone, p.age, p.gender,
            d.name as doctor_name, d.specialization,
            dept.name as department_name
     FROM tokens t
     JOIN patients p ON t.patient_id = p.id
     JOIN doctors d ON t.doctor_id = d.id
     JOIN departments dept ON t.department_id = dept.id
     WHERE t.id = ?`,
    [id],
    (err, token) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.json(token);
    }
  );
});

module.exports = router;
