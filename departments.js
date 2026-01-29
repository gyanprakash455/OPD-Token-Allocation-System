const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all departments
router.get('/', (req, res) => {
  const dbInstance = db.getDb();
  
  dbInstance.all('SELECT * FROM departments ORDER BY name ASC', (err, departments) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(departments);
  });
});

// Get department by ID
router.get('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  
  dbInstance.get('SELECT * FROM departments WHERE id = ?', [id], (err, department) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json(department);
  });
});

// Create new department
router.post('/', (req, res) => {
  const dbInstance = db.getDb();
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Department name is required' });
  }

  dbInstance.run(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [name, description || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      dbInstance.get('SELECT * FROM departments WHERE id = ?', [this.lastID], (err, department) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json(department);
      });
    }
  );
});

// Update department
router.put('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  const { name, description } = req.body;
  
  dbInstance.run(
    'UPDATE departments SET name = ?, description = ? WHERE id = ?',
    [name, description, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }
      dbInstance.get('SELECT * FROM departments WHERE id = ?', [id], (err, department) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(department);
      });
    }
  );
});

// Delete department
router.delete('/:id', (req, res) => {
  const dbInstance = db.getDb();
  const { id } = req.params;
  
  dbInstance.run('DELETE FROM departments WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ message: 'Department deleted successfully' });
  });
});

module.exports = router;
