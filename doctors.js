const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all doctors
router.get('/', (req, res) => {
  const dbInstance = db.getDb();
  const { department_id, is_active } = req.query;
  
  let query = `
    SELECT d.*, dept.name as department_name
    FROM doctors d
    JOIN departments dept ON d.department_id = dept.id
    WHERE 1=1
  `;
  const params = [];

  if (department_id) {
    query += ' AND d.department_id = ?';
    params.push(department_id);
  }
  if (is_active !== undefined) {
    query += ' AND d.is_active = ?';
    params.push(is_active === 'true' ? 1 : 0);
  }

  query += ' ORDER BY d.name ASC';

  dbInstance.all(query, params, (err, doctors) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(doctors);
  });
});

// Get doctor by ID
router.get('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  
  dbInstance.get(
    `SELECT d.*, dept.name as department_name
     FROM doctors d
     JOIN departments dept ON d.department_id = dept.id
     WHERE d.id = ?`,
    [id],
    (err, doctor) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor not found' });
      }
      res.json(doctor);
    }
  );
});

// Create new doctor
router.post('/', (req, res) => {
  const dbInstance = db.getDb();
  const { name, department_id, specialization, email, phone } = req.body;
  
  if (!name || !department_id) {
    return res.status(400).json({ error: 'Name and department are required' });
  }

  dbInstance.run(
    `INSERT INTO doctors (name, department_id, specialization, email, phone)
     VALUES (?, ?, ?, ?, ?)`,
    [name, department_id, specialization || null, email || null, phone || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      dbInstance.get(
        `SELECT d.*, dept.name as department_name
         FROM doctors d
         JOIN departments dept ON d.department_id = dept.id
         WHERE d.id = ?`,
        [this.lastID],
        (err, doctor) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.status(201).json(doctor);
        }
      );
    }
  );
});

// Update doctor
router.put('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  const { name, department_id, specialization, email, phone, is_active } = req.body;
  
  dbInstance.run(
    `UPDATE doctors SET name = ?, department_id = ?, specialization = ?, 
     email = ?, phone = ?, is_active = ?
     WHERE id = ?`,
    [name, department_id, specialization, email, phone, is_active !== undefined ? is_active : 1, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Doctor not found' });
      }
      dbInstance.get(
        `SELECT d.*, dept.name as department_name
         FROM doctors d
         JOIN departments dept ON d.department_id = dept.id
         WHERE d.id = ?`,
        [id],
        (err, doctor) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json(doctor);
        }
      );
    }
  );
});

// Delete doctor
router.delete('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  
  dbInstance.run('DELETE FROM doctors WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json({ message: 'Doctor deleted successfully' });
  });
});

module.exports = router;
