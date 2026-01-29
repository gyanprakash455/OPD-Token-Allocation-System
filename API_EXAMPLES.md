# API Examples (Sample Request/Response)

Base URL: `http://localhost:5000/api`

> Note: Examples use **Windows PowerShell** line continuation (`^`) with `curl`.

## 1) Health check

**Request**

```bash
curl http://localhost:5000/api/health
```

**Response**

```json
{ "status": "OK", "message": "OPD Token Allocation System API" }
```

## 2) Create a patient

**Request**

```bash
curl -X POST http://localhost:5000/api/patients ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Asha Kumar\",\"phone\":\"9876543210\",\"age\":29,\"gender\":\"F\",\"address\":\"Sector 12\"}"
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
  "address": "Sector 12",
  "created_at": "2026-01-29 10:12:30"
}
```

## 3) List departments

**Request**

```bash
curl http://localhost:5000/api/departments
```

**Response (200)**

```json
[
  { "id": 1, "name": "General Medicine", "description": "General medical consultations", "created_at": "..." }
]
```

## 4) List doctors in a department

**Request**

```bash
curl "http://localhost:5000/api/doctors?department_id=1&is_active=true"
```

**Response (200)**

```json
[
  {
    "id": 1,
    "name": "Dr. John Smith",
    "department_id": 1,
    "specialization": "General Physician",
    "email": "john.smith@hospital.com",
    "phone": "1234567890",
    "is_active": 1,
    "created_at": "...",
    "department_name": "General Medicine"
  }
]
```

## 5) Create a token (allocation)

**Request**

```bash
curl -X POST http://localhost:5000/api/tokens ^
  -H "Content-Type: application/json" ^
  -d "{\"patient_id\":1,\"doctor_id\":1,\"department_id\":1,\"priority\":\"normal\",\"appointment_date\":\"2026-01-29\"}"
```

**Response (201)** (example)

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
  "created_at": "...",
  "called_at": null,
  "completed_at": null,
  "patient_name": "Asha Kumar",
  "patient_phone": "9876543210",
  "doctor_name": "Dr. John Smith",
  "department_name": "General Medicine"
}
```

## 6) Get display tokens for a department (waiting + in_progress)

**Request**

```bash
curl http://localhost:5000/api/tokens/display/1
```

**Response (200)**

```json
[
  { "id": 10, "token_number": 3, "status": "waiting", "priority": "normal", "patient_name": "Asha Kumar", "doctor_name": "Dr. John Smith", "...": "..." }
]
```

## 7) Update token status

**Request**

```bash
curl -X PATCH http://localhost:5000/api/tokens/10/status ^
  -H "Content-Type: application/json" ^
  -d "{\"status\":\"in_progress\"}"
```

**Response (200)** (example)

```json
{
  "id": 10,
  "token_number": 3,
  "status": "in_progress",
  "called_at": "...",
  "patient_name": "Asha Kumar",
  "doctor_name": "Dr. John Smith",
  "department_name": "General Medicine"
}
```

