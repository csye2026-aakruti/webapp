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