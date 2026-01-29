const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all patients
router.get('/', (req, res) => {
  const dbInstance = db.getDb();
  
  dbInstance.all('SELECT * FROM patients ORDER BY created_at DESC', (err, patients) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(patients);
  });
});

// Get patient by ID
router.get('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  
  dbInstance.get('SELECT * FROM patients WHERE id = ?', [id], (err, patient) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(patient);
  });
});

// Create new patient
router.post('/', (req, res) => {
  const dbInstance = db.getDb();
  const { name, phone, email, age, gender, address } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  dbInstance.run(
    `INSERT INTO patients (name, phone, email, age, gender, address) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, phone, email || null, age || null, gender || null, address || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      dbInstance.get('SELECT * FROM patients WHERE id = ?', [this.lastID], (err, patient) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json(patient);
      });
    }
  );
});

// Update patient
router.put('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  const { name, phone, email, age, gender, address } = req.body;
  
  dbInstance.run(
    `UPDATE patients SET name = ?, phone = ?, email = ?, age = ?, gender = ?, address = ?
     WHERE id = ?`,
    [name, phone, email, age, gender, address, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      dbInstance.get('SELECT * FROM patients WHERE id = ?', [id], (err, patient) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(patient);
      });
    }
  );
});

module.exports = router;
