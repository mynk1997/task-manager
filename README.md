# Task Manager

A public-ready task manager in an npm-workspaces monorepo.

## Apps

- `apps/web` — React and Vite client.
- `apps/api` — Express and TypeScript API with first-party session authentication.
- `packages/api-contract` — Shared API validation contracts.
- `infra` — local PostgreSQL development resources.

## Local setup

1. Install Node.js 20.19 or newer.
2. Run `npm install` at the repository root.
3. Copy `apps/api/.env.example` to `apps/api/.env` and configure it for your database. For public deployment, configure `SMTP_URL` and `EMAIL_FROM` so account verification and password reset emails can be delivered.
4. Start PostgreSQL with `docker compose -f infra/docker-compose.yml up -d`.
5. Generate and apply migrations with `npm run db:generate --workspace=@task-manager/api` and `npm run db:migrate --workspace=@task-manager/api`.
6. Run `npm run dev:api` and `npm run dev:web` in separate terminals.

Run `npm run typecheck`, `npm run lint`, and `npm test` before committing.

## Backend design

The API is mounted under `/api/v1`; its full requirements are in [docs/backend-requirements.md](docs/backend-requirements.md).
