# Bookly

A backend API for publishing events and booking spots in them. Organizers create events and ticket types with limited capacity. Users book tickets. Every spot becomes its own ticket with a unique QR code, and the organizer scans it at the door.

## Features

- Register, log in, and role-based access (Admin, Organizer, User)
- Users apply to become organizers, and admins approve or reject
- Organizers create, publish, and cancel events, and define ticket types
- Users book tickets, add tickets, cancel single tickets, or cancel a booking
- Capacity is enforced per ticket type, even when many users book at the same time
- Check-in at the door by scanning the ticket code
- Users can delete (anonymize) their own account

## Tech stack

Node.js, TypeScript, Express 5, PostgreSQL, Prisma 7, Zod, JWT, Vitest, Supertest, Docker, GitHub Actions.

## Engineering

- **Security:** Helmet headers, CORS limited to one origin, rate limiting on login and register, env variables checked at startup
- **Observability:** structured logs (pino) with a request ID and response time on every request, errors sent to Sentry
- **Health checks:** `/health/live` (is the process up) and `/health/ready` (can it reach the database)
- **CI:** GitHub Actions runs migrations, type check, lint, and tests on a real PostgreSQL for every push and PR to `main`
- **Docker:** multi-stage build, Docker Compose for the API and PostgreSQL

## Quick start (Docker)

1. Copy `.env.docker.example` to `.env.docker` and fill it in (see [Environment variables](#environment-variables)).
2. Run these commands in order:

```bash
docker compose --env-file .env.docker up -d db
docker compose --env-file .env.docker run --rm migrate
docker compose --env-file .env.docker up -d --build api
docker compose --env-file .env.docker run --rm api node dist/src/scripts/run-seed-admin.js   # once, creates the first admin
```

The API runs at http://localhost:3000.

> Never run `docker compose down -v`. It deletes the database volume.
> After code changes, rebuild with `up -d --build api`.

## Run locally (without Docker for the API)

```bash
npm ci
npx prisma generate
npx prisma migrate dev
npm run seed:admin
npm run dev
```

You need a `.env` file first (see below).

## Environment variables

| Variable | Meaning |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | Port the API listens on |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random secret for signing tokens |
| `JWT_EXPIRES_IN` | Token lifetime, for example `1h` |
| `CLIENT_ORIGIN_DEV`, `CLIENT_ORIGIN_PROD` | The one frontend origin allowed by CORS |
| `LOGIN_RATE_LIMIT`, `REGISTER_RATE_LIMIT` | Max failed logins per 15 min, and max registrations per hour, per IP |
| `SENTRY_DSN` | Where errors are sent |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first admin (password must be strong) |

The app refuses to start if one of the required variables is missing.

## Tests

Tests are integration tests: real API, real PostgreSQL, including concurrency cases (many users booking the last spots, double cancel, two scanners on one ticket).

1. Create a database named `event_booking_test`.
2. Create `.env.test` with a `DATABASE_URL` that points to it.
3. `npm run test:db:migrate`
4. `npm test`

The tests refuse to run on any database not named `event_booking_test`, because they delete all data before each test.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with auto reload |
| `npm run build` / `npm start` | Compile and run |
| `npm run typecheck` | Type check |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm test` | Run all tests once |
| `npm run seed:admin` | Create the first admin |

## API documentation

Available only when `NODE_ENV` is not `production`:

- Swagger UI: http://localhost:3000/api-docs
- OpenAPI JSON (for Postman): http://localhost:3000/openapi.json

More: [Business requirements](docs/business-requirements.md) (roles, entities, rules, locking).

## Known limitations

- Docker image is large (~870 MB) because of Prisma tooling.
- Migrations and the admin seed are manual steps.
- No payments, notifications, or background jobs yet.

## License

ISC
