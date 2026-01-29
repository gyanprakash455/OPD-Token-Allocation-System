# Database Schema (SQLite)

Database file: `server/data/opd_tokens.db`

## PRAGMAs
- `foreign_keys = ON`
- `journal_mode = WAL`
- `busy_timeout = 5000`

## Tables

### `departments`
- `id` INTEGER PK AUTOINCREMENT
- `name` TEXT NOT NULL UNIQUE
- `description` TEXT NULL
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### `doctors`
- `id` INTEGER PK AUTOINCREMENT
- `name` TEXT NOT NULL
- `department_id` INTEGER NOT NULL (FK → `departments.id`)
- `specialization` TEXT NULL
- `email` TEXT NULL UNIQUE
- `phone` TEXT NULL
- `is_active` INTEGER DEFAULT 1
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### `patients`
- `id` INTEGER PK AUTOINCREMENT
- `name` TEXT NOT NULL
- `phone` TEXT NOT NULL
- `email` TEXT NULL
- `age` INTEGER NULL
- `gender` TEXT NULL
- `address` TEXT NULL
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### `tokens`
- `id` INTEGER PK AUTOINCREMENT
- `token_number` INTEGER NOT NULL
- `patient_id` INTEGER NOT NULL (FK → `patients.id`)
- `doctor_id` INTEGER NOT NULL (FK → `doctors.id`)
- `department_id` INTEGER NOT NULL (FK → `departments.id`)
- `status` TEXT DEFAULT `waiting` CHECK in (`waiting`, `in_progress`, `completed`, `cancelled`)
- `priority` TEXT DEFAULT `normal` CHECK in (`normal`, `urgent`, `vip`)
- `appointment_date` DATE NOT NULL
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- `called_at` DATETIME NULL
- `completed_at` DATETIME NULL

#### Indexes
- **Unique**: `idx_tokens_unique_day_dept_token` on `(department_id, DATE(appointment_date), token_number)`

### `admin_users`
- `id` INTEGER PK AUTOINCREMENT
- `username` TEXT NOT NULL UNIQUE
- `password` TEXT NOT NULL (bcrypt hash)
- `role` TEXT DEFAULT `admin`
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

