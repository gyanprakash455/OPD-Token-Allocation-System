const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../data/opd_tokens.db');

let db = null;

const initialize = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      // Basic safety/perf defaults for SQLite
      db.exec(
        `
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        `,
        (pragmaErr) => {
          if (pragmaErr) {
            reject(pragmaErr);
            return;
          }
          createTables().then(resolve).catch(reject);
        }
      );
    });
  });
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    const adminPasswordHash = bcrypt.hashSync('admin123', 10);

    db.exec(
      `
      BEGIN;

      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department_id INTEGER NOT NULL,
        specialization TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );

      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        age INTEGER,
        gender TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_number INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        department_id INTEGER NOT NULL,
        status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
        priority TEXT DEFAULT 'normal' CHECK(priority IN ('normal', 'urgent', 'vip')),
        appointment_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        called_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id),
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );

      -- Prevent duplicate token numbers per department per day (critical for concurrency correctness)
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_unique_day_dept_token
      ON tokens(department_id, DATE(appointment_date), token_number);

      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      COMMIT;
      `,
      (schemaErr) => {
        if (schemaErr) {
          reject(schemaErr);
          return;
        }

        // Seed data (idempotent)
        db.serialize(() => {
          db.run(
            `INSERT OR IGNORE INTO admin_users (username, password, role) VALUES ('admin', ?, 'admin')`,
            [adminPasswordHash]
          );

          db.run(
            `INSERT OR IGNORE INTO departments (name, description) VALUES
              ('General Medicine', 'General medical consultations'),
              ('Cardiology', 'Heart and cardiovascular diseases'),
              ('Orthopedics', 'Bone and joint related issues'),
              ('Pediatrics', 'Child healthcare'),
              ('Dermatology', 'Skin related issues')`
          );

          db.run(
            `INSERT OR IGNORE INTO doctors (name, department_id, specialization, email, phone) VALUES
              ('Dr. John Smith', 1, 'General Physician', 'john.smith@hospital.com', '1234567890'),
              ('Dr. Sarah Johnson', 2, 'Cardiologist', 'sarah.j@hospital.com', '1234567891'),
              ('Dr. Michael Brown', 3, 'Orthopedic Surgeon', 'michael.b@hospital.com', '1234567892'),
              ('Dr. Emily Davis', 4, 'Pediatrician', 'emily.d@hospital.com', '1234567893'),
              ('Dr. Robert Wilson', 5, 'Dermatologist', 'robert.w@hospital.com', '1234567894')`,
            (seedErr) => {
              if (seedErr) {
                reject(seedErr);
                return;
              }
              console.log('Database tables created successfully');
              resolve();
            }
          );
        });
      }
    );
  });
};

const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

const close = () => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
};

module.exports = {
  initialize,
  getDb,
  close
};
