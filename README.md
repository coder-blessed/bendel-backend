# Bendel Backend

A Node.js + Express + PostgreSQL backend for Bendel Insurance FC operations.

## Features

- Admin authentication
- User profile storage
- Ticket and merchandise order records
- Cloudinary image upload support
- Render-ready Postgres configuration

## Quick start

1. Copy `.env.example` to `.env`
2. Fill in your Postgres and Cloudinary values
3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

## API

### Health

```bash
GET /api/health
```

### Admin login

```bash
POST /api/auth/login
```

### Profile

```bash
GET /api/profile
PUT /api/profile
```

### Orders

```bash
POST /api/orders
GET /api/orders
GET /api/orders/me
GET /api/orders/:id
PATCH /api/orders/:id/status
```

## Environment variables

See `.env.example` for the complete list. The key values for this project are:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SQUAD_API_BASE_URL`
- `SQUAD_API_KEY`
- `SQUAD_SECRET_KEY`
