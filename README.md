# Bookly

A backend API for publishing events and booking spots in them. Organizers create events and ticket types with limited capacity. Users book tickets. Every spot becomes its own ticket with a unique QR code, and the organizer scans it at the door.

## Features

- Register, log in, and role-based access (Admin, Organizer, User)
- Users apply to become organizers, and admins approve or reject
- Organizers create, publish, and cancel events, and define ticket types
- Users book tickets, add tickets, cancel single tickets, or cancel a booking
- Capacity is enforced per ticket type, even with many users booking at the same time
- Check-in at the door by scanning the ticket code
- Users can delete (anonymize) their own account

## Tech stack

Node.js, TypeScript, Express 5, PostgreSQL, Prisma 7, Zod, JWT, Vitest + Supertest, Docker.

## Run with Docker

You need Docker and Docker Compose.

1. Create `.env.docker` in the project root (copy `.env.docker.example`) and fill in the values:

   | Variable | Meaning |
   |---|---|
   | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials. Use a password without special characters. |
   | `JWT_SECRET` | Long random secret for signing tokens |
   | `JWT_EXPIRES_IN` | Token lifetime, for example `1h` |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first admin account. Use a strong password. |

2. Start the database:

   ```bash
   docker compose --env-file .env.docker up -d db
   ```

3. Run the migrations (one-off container):

   ```bash
   docker compose --env-file .env.docker run --rm migrate
   ```

4. Start the API:

   ```bash
   docker compose --env-file .env.docker up -d --build api
   ```

5. Create the first admin (run once on a new database):

   ```bash
   docker compose --env-file .env.docker run --rm api node dist/src/scripts/run-seed-admin.js
   ```

The API is at http://localhost:3000. The database is exposed on host port 5433.

Useful commands:

```bash
docker compose --env-file .env.docker logs api    # see API logs
docker compose --env-file .env.docker down        # stop (data is kept)
```

> Do not use `down -v`. It deletes the database volume and all your data.

If you change the code or the Dockerfile, rebuild with `up -d --build api`. Plain `up` and `run` reuse the old image.

## Run locally (without Docker for the API)

1. Install dependencies: `npm ci`
2. Create `.env` with `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Generate the Prisma client and apply migrations: `npx prisma generate` then `npx prisma migrate dev`
4. Create the admin: `npm run seed:admin`
5. Start the dev server: `npm run dev`

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with auto reload |
| `npm run build` / `npm start` | Compile and run the compiled app |
| `npm run typecheck` | Type check without building |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Run all tests once |
| `npm run seed:admin` | Create the first admin |

## Tests

Tests are integration tests. They call the real API and a real PostgreSQL database, including concurrency tests (many users booking the last spots, double cancel, two scanners on one ticket).

1. Create a database named `event_booking_test`.
2. Create `.env.test` with a `DATABASE_URL` that points to it.
3. Apply the migrations to that database. TODO: write the exact command you use. Run `npm run test:db:migrate`
4. Run `npm test`.

The test setup refuses to run on any database not named `event_booking_test`, and it deletes all data in it before each test. This protects your real data.

## API documentation

With the API running:

- Swagger UI: http://localhost:3000/api-docs
- OpenAPI JSON (for Postman): http://localhost:3000/openapi.json

## More documentation

- [Business requirements](docs/business-requirements.md): roles, entities, business rules, locking strategy. 

## Known limitations and next steps

- No `/health` endpoint and no graceful shutdown yet
- Docker image is large (about 870 MB) because of Prisma tooling
- Migrations and the admin seed are manual steps
- No payments, notifications, or background jobs in v1 (see the requirements doc)

## License

ISC