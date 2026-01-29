# Design Explanation — OPD Token Allocation System

## Goal
Provide a simple OPD queue workflow:
- Register patient
- Allocate token for a doctor/department for a given date
- Track token lifecycle (`waiting → in_progress → completed/cancelled`)
- Provide a department display board

## Architecture

### Backend
- **Runtime**: Node.js + Express
- **Database**: SQLite (single file) for easy local evaluation
- **Real-time**: Socket.IO for pushing updates to display clients

Key files:
- `server/index.js`: server bootstrap + Socket.IO setup
- `server/config/database.js`: schema creation, seed data, SQLite PRAGMAs
- `server/routes/*`: REST endpoints

### Frontend
- React app (in `client/`) consumes REST endpoints and listens for Socket.IO events (display board).

## Token allocation (correctness + concurrency)

### Invariants
1. Token numbers are **unique per (department, date)**.
2. Token numbers are sequential (1..N) within a (department, date).
3. A token cannot reference invalid foreign keys (patient, doctor, department).

### How uniqueness is guaranteed
1. **Database constraint**: unique index on `(department_id, DATE(appointment_date), token_number)`
2. **Concurrency control**: allocation occurs inside `BEGIN IMMEDIATE` so only one writer can compute `MAX(token_number)+1` for that scope at a time.
3. **Single-statement allocation**: `INSERT INTO ... SELECT COALESCE(MAX(token_number),0)+1 ...` reduces race windows.

This means even if multiple clients hit `POST /api/tokens` at the same time, the system will not issue duplicate token numbers.

## Edge cases handled
- **Doctor mismatch**: cannot allocate a token if the doctor is not in the selected department.
- **Inactive doctor**: cannot allocate a token to an inactive doctor.
- **Missing entities**: patient/doctor not found → 404 with a clear message.
- **Invalid enums**: invalid `priority` or `status` → 400.
- **Route shadowing**: `/tokens/display/:departmentId` and `/tokens/next/:departmentId` are defined before `/tokens/:id`.

## Scalability notes (what to do next for production)
- Replace SQLite with Postgres/MySQL.
- Move allocation to a **sequence-based** strategy (or `SERIALIZABLE` transaction) and/or keep per-day counters.
- Add indexes for common filters: `(department_id, DATE(appointment_date), status)` etc.
- Split read-heavy display endpoints behind caching if needed.

