# OPD Token Allocation System

An **OPD (Outpatient Department) Token Allocation System** to register patients, allocate tokens to departments/doctors, manage queue status, and provide a real-time display board.

## Deliverables
- **Source code (GitHub repository)**: push this folder to GitHub (see “Publish to GitHub” below).
- **API documentation (README)**: this file.
- **Database schema**: see “Database schema” below and `DATABASE_SCHEMA.md`.
- **Sample request/response**: see “Sample API requests/responses” below and `API_EXAMPLES.md`.
- **Design explanation**: see “Design explanation” below and `DESIGN.md`.

## Evaluation criteria mapping

### Correctness of token allocation logic
- **Per-department, per-day token numbering**: token numbers are generated as \(`MAX(token_number) + 1`\) for a given `(department_id, appointment_date)`.
- **DB-enforced uniqueness**: a unique index prevents duplicates:
  - `idx_tokens_unique_day_dept_token` on `(department_id, DATE(appointment_date), token_number)`.

### Handling of concurrency and edge cases
- **Concurrency-safe allocation**: token creation uses `BEGIN IMMEDIATE` + single `INSERT ... SELECT MAX()+1` statement, so concurrent requests cannot allocate the same token number.
- **Busy-timeout + WAL**: SQLite is configured with `PRAGMA busy_timeout=5000` and `journal_mode=WAL` for better concurrent behavior.
- **Foreign-key and relationship validation** (before allocation):
  - Patient must exist
  - Doctor must exist and be active
  - Doctor must belong to the selected department
- **Route correctness**: `/tokens/display/:departmentId` and `/tokens/next/:departmentId` are defined **before** `GET /tokens/:id` to avoid accidental shadowing.

### Code quality and structure
- **Separation by feature**:
  - `server/index.js` for app bootstrap + sockets
  - `server/config/database.js` for schema + seed + PRAGMAs
  - `server/routes/*` for API routes

### API design and clarity
Base URL: `http://localhost:5000/api`

#### Auth
- `POST /auth/login` (admin session)
- `POST /auth/logout`
- `GET /auth/session`

#### Core resources
- `GET /departments`
- `GET /doctors?department_id=...`
- `POST /patients`
- `GET /patients`

#### Tokens
- `POST /tokens`
  - body: `{ patient_id, doctor_id, department_id, priority, appointment_date }`
- `GET /tokens?department_id=&doctor_id=&status=&date=`
- `PATCH /tokens/:id/status`
  - body: `{ status }` where status ∈ `waiting|in_progress|completed|cancelled`
- `GET /tokens/display/:departmentId`
- `GET /tokens/next/:departmentId`
- `GET /tokens/:id`

### Scalability considerations
- Token uniqueness is enforced at the database layer (not just in application code).
- Real-time updates are broadcast using Socket.IO rooms per department: `department-{id}`.
- For production scale: switch DB to Postgres/MySQL, move allocation to `SERIALIZABLE`/sequence-based strategy, and add indexes on query filters (department/date/status).

### Documentation quality
- This README explains how correctness and concurrency are achieved, and lists the API clearly.

## Database schema

SQLite file: `server/data/opd_tokens.db`

### Tables
- **departments**
  - `id` (PK), `name` (UNIQUE, NOT NULL), `description`, `created_at`
- **doctors**
  - `id` (PK), `name` (NOT NULL), `department_id` (FK), `specialization`, `email` (UNIQUE), `phone`, `is_active`, `created_at`
- **patients**
  - `id` (PK), `name` (NOT NULL), `phone` (NOT NULL), `email`, `age`, `gender`, `address`, `created_at`
- **tokens**
  - `id` (PK), `token_number` (NOT NULL), `patient_id` (FK), `doctor_id` (FK), `department_id` (FK)
  - `status` ∈ `waiting|in_progress|completed|cancelled`
  - `priority` ∈ `normal|urgent|vip`
  - `appointment_date` (DATE, NOT NULL), `created_at`, `called_at`, `completed_at`
  - **unique**: `(department_id, DATE(appointment_date), token_number)`
- **admin_users**
  - `id` (PK), `username` (UNIQUE, NOT NULL), `password` (bcrypt hash), `role`, `created_at`

## Sample API requests/responses

Base URL: `http://localhost:5000/api`

### Create patient

**Request**

```bash
curl -X POST http://localhost:5000/api/patients ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Asha Kumar\",\"phone\":\"9876543210\",\"age\":29,\"gender\":\"F\"}"
```

**Response (201)**

```json
{
  "id": 1,
  "name": "Asha Kumar",
  "phone": "9876543210",
  "email": null,
  "age": 29,
  "gender": "F",
  "address": null,
  "created_at": "2026-01-29 10:12:30"
}
```

### Create token (concurrency-safe allocation)

**Request**

```bash
curl -X POST http://localhost:5000/api/tokens ^
  -H "Content-Type: application/json" ^
  -d "{\"patient_id\":1,\"doctor_id\":1,\"department_id\":1,\"priority\":\"normal\",\"appointment_date\":\"2026-01-29\"}"
```

**Response (201)**

```json
{
  "id": 10,
  "token_number": 3,
  "patient_id": 1,
  "doctor_id": 1,
  "department_id": 1,
  "status": "waiting",
  "priority": "normal",
  "appointment_date": "2026-01-29",
  "created_at": "2026-01-29 10:13:10",
  "called_at": null,
  "completed_at": null,
  "patient_name": "Asha Kumar",
  "patient_phone": "9876543210",
  "doctor_name": "Dr. John Smith",
  "department_name": "General Medicine"
}
```

### Update token status

**Request**

```bash
curl -X PATCH http://localhost:5000/api/tokens/10/status ^
  -H "Content-Type: application/json" ^
  -d "{\"status\":\"in_progress\"}"
```

## Design explanation

### Problem
Allocate OPD queue tokens without duplicates, support queue visibility, and handle concurrent requests reliably.

### Approach
- **Single source of truth**: SQLite database holds the queue state.
- **Token uniqueness**: enforced by a DB unique index.
- **Concurrency**: token creation runs in an `IMMEDIATE` transaction, then uses one `INSERT ... SELECT MAX()+1` statement to allocate the next number safely.
- **Validation**: patient/doctor existence + doctor-to-department constraint prevents inconsistent allocations.
- **Real-time updates**: Socket.IO rooms per department allow display boards to update live.

## Run locally (Windows / PowerShell)

From the project root:

```bash
npm run install-all
```

Start both backend and frontend:

```bash
npm run dev
```

Backend health check:
- `GET http://localhost:5000/api/health`

## Default admin login
- **username**: `admin`
- **password**: `admin123`

## Publish to GitHub
From the project root (PowerShell):

```bash
git init
git add .
git commit -m "Initial commit: OPD token allocation system"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

