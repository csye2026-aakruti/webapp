# Cloud-Native Web Application – CSYE 6225

API-only backend web application built for CSYE 6225 following cloud-native principles.

---

## Tech Stack
- **Runtime:** Node.js 18+
- **Framework:** NestJS
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Authentication:** Basic Auth (BCrypt)
- **Testing:** Jest + SuperTest
- **CI:** GitHub Actions

---

## Prerequisites
- Node.js 18+
- npm
- PostgreSQL 14+
- Git (SSH configured)

---

## Environment Variables

Create a `.env` file in the project root (**do not commit**):

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=webapp

Test Environment

E2E tests use a separate test database via .env.test locally (**do not commit it**).

Example .env.test:

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=webapp_test

Build Instructions

Build the application:

npm run build

Run Instructions (Local)

Start the server in dev mode:

npm run start:dev

The app runs on:
	•	http://localhost:3000

API Testing / Verification

Health Check
	•	GET /healthz → 200 if DB insert succeeds, 503 if DB is down
	•	Non-GET methods (POST/PUT/PATCH/DELETE/HEAD/OPTIONS) → 405
	•	GET with payload → 400

Example:

curl -i http://localhost:3000/healthz

User APIs
	•	POST /v1/user (create user)
	•	GET /v1/user/self (requires Basic Auth)
	•	PUT /v1/user/self (requires Basic Auth)

Running Tests

Run unit tests:

npm test

Run E2E tests:

npm run test:e2e

Deployment Notes

This is an API-only backend (no UI).

# testing