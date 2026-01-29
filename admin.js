const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware to check admin authentication
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Get dashboard statistics
router.get('/stats', requireAuth, (req, res) => {
  const dbInstance = db.getDb();
  const today = new Date().toISOString().split('T')[0];
  
  const stats = {};
  let completed = 0;

  // Get total tokens today
  dbInstance.get(
    `SELECT COUNT(*) as count FROM tokens WHERE DATE(appointment_date) = DATE(?)`,
    [today],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.totalTokensToday = result.count;

      // Get waiting tokens
      dbInstance.get(
        `SELECT COUNT(*) as count FROM tokens WHERE DATE(appointment_date) = DATE(?) AND status = 'waiting'`,
        [today],
        (err, result) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          stats.waitingTokens = result.count;

          // Get in-progress tokens
          dbInstance.get(
            `SELECT COUNT(*) as count FROM tokens WHERE DATE(appointment_date) = DATE(?) AND status = 'in_progress'`,
            [today],
            (err, result) => {
              if (err) return res.status(500).json({ error: 'Database error' });
              stats.inProgressTokens = result.count;

              // Get completed tokens
              dbInstance.get(
                `SELECT COUNT(*) as count FROM tokens WHERE DATE(appointment_date) = DATE(?) AND status = 'completed'`,
                [today],
                (err, result) => {
                  if (err) return res.status(500).json({ error: 'Database error' });
                  stats.completedTokens = result.count;

                  // Get total patients
                  dbInstance.get('SELECT COUNT(*) as count FROM patients', [], (err, result) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    stats.totalPatients = result.count;

                    // Get total doctors
                    dbInstance.get('SELECT COUNT(*) as count FROM doctors WHERE is_active = 1', [], (err, result) => {
                      if (err) return res.status(500).json({ error: 'Database error' });
                      stats.totalDoctors = result.count;

                      // Get total departments
                      dbInstance.get('SELECT COUNT(*) as count FROM departments', [], (err, result) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        stats.totalDepartments = result.count;

                        res.json(stats);
                      });
                    });
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

module.exports = router;
