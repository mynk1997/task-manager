# Task Manager Backend Requirements (Draft)

## 1. Purpose

Replace the current browser-only task storage with a secure API and persistent database. The backend must support the existing React task-manager experience, self-managed accounts, multiple devices, and public production use.

## 2. Current product behaviour

The frontend is a daily planner. A user can select a date, view its scheduled and unscheduled tasks, and see the day's completion progress. They can create, edit, complete/reopen, and delete tasks. At present, these tasks live only in `localStorage` and sample tasks are shown for a new browser.

## 3. Goals for the first backend release

- Persist a user's tasks in a database.
- Let users register and sign in with first-party email-and-password accounts; no third-party identity provider is used.
- Let a signed-in user access only their own tasks.
- Support title, optional notes, a timezone-relative task date, an optional displayed time, and completion status.
- Return tasks for a selected day efficiently, including both scheduled and unscheduled tasks.
- Provide a clear API contract for the React client.
- Make local development, testing, and deployment repeatable.

## 4. Out of scope for the first release

- Social login, passkeys, multi-factor authentication, and account merging. These are post-MVP additions to the first-party auth system.
- Recurring tasks, reminders, push/email notifications, attachments, collaboration, shared lists, and offline sync conflict resolution.
- Arbitrary task ordering beyond the current time-first display order.
- Administrative dashboards and analytics.
- Importing existing browser `localStorage` data automatically. A one-time opt-in import can be added after the core API works.

## 5. Accounts, authentication, and permissions

The initial model has one role: **user**. Authentication is owned by this service and uses email and password—there is no third-party authentication provider.

- `POST /auth/register` creates an account with an email address that must be verified, and a password that meets the defined strength policy.
- `POST /auth/login` creates a server-side session; `POST /auth/logout` invalidates the current session; `GET /auth/me` returns the current user.
- Include email verification and password-reset flows before public launch. Verification/reset tokens must be single-use, short-lived, randomly generated, and stored hashed.
- Store passwords only as adaptive password hashes (Argon2id is the default); never store or log plaintext passwords.
- Use opaque, server-stored sessions delivered in a `Secure`, `HttpOnly`, `SameSite` cookie. Rotate the session identifier on login and password change; do not store credentials or session tokens in browser storage.
- Rate-limit registration, login, password-reset, and verification endpoints. Apply progressive abuse controls and generic error messages where needed to prevent account enumeration.
- A user can create, read, update, and delete only their own tasks.
- Requests without valid authentication are rejected, except health checks and any explicitly public auth routes.
- Server-side ownership checks are mandatory; the client must never be trusted to supply a user ID.

## 6. Task data model

| Field | Type | Rules |
| --- | --- | --- |
| `id` | UUID | Server-generated primary key. |
| `userId` | UUID/string | Required owner reference; never client-controlled. |
| `title` | string | Required after trimming; 1–200 characters. |
| `description` | string/null | Optional; maximum 2,000 characters. |
| `scheduledAt` | UTC timestamp | Required task anchor instant, resolved using the creator's IANA timezone. |
| `hasScheduledTime` | boolean | Whether the UI displays the task's local time; `false` retains the current unscheduled visual treatment. |
| `status` | enum | `pending` or `completed`. |
| `completedAt` | timestamp/null | Set on completion and cleared when reopened. |
| `createdAt` | timestamp | Server-generated. |
| `updatedAt` | timestamp | Server-managed. |

Recommended database constraints and indexes:

- Index `(userId, scheduledAt)` for task-range/day views.
- Validate the status enum, title length, and date/time formats both at the API boundary and database layer where practical.
- Use UTC timestamps for task anchors and audit fields. The API receives the creator's IANA timezone (for example, `Asia/Kolkata`) and resolves the entered date/time to `scheduledAt`.

### Timezone policy (decided)

The day shown for a task changes based on the user's current IANA timezone. The client sends that timezone with date-range requests; the server translates the local start and end of that day to a UTC range before querying. A timed task therefore displays a different local date/time when the user travels.

To apply the same rule to an unscheduled task, the server assigns a hidden local-noon anchor when the task is created (`hasScheduledTime: false`). It remains visually unscheduled, but its displayed day can still change when the user changes timezone. This is an explicit product trade-off: a date-only task will not stay fixed to the original calendar date after travel.

## 7. API requirements

Base path: `/api/v1`. Responses use JSON and identifiers are opaque strings/UUIDs.

| Method and route | Behaviour |
| --- | --- |
| `GET /health` | Public liveness/readiness check. |
| `POST /auth/register` | Create a first-party account and start email verification. |
| `POST /auth/login` | Authenticate with email/password and create a session. |
| `POST /auth/logout` | End the current session. |
| `GET /auth/me` | Return the authenticated user's profile and session state. |
| `POST /auth/password-reset/request` | Request a password-reset email without exposing whether an account exists. |
| `POST /auth/password-reset/confirm` | Redeem a valid reset token and replace the password. |
| `GET /tasks?date=YYYY-MM-DD` | Return the authenticated user's tasks for one date, ordered by time then creation time. |
| `POST /tasks` | Create a task. Requires title and scheduled date; accepts optional description and scheduled time. |
| `GET /tasks/:id` | Return one owned task. |
| `PATCH /tasks/:id` | Update one or more editable fields, including status. |
| `DELETE /tasks/:id` | Permanently delete an owned task; return `204 No Content`. |

### API behaviour

- `201 Created` for successful creation, including the full task resource.
- `400 Bad Request` for malformed request JSON or query strings; `422 Unprocessable Content` for valid JSON that fails field validation.
- `401 Unauthorized` for missing/invalid authentication, and `404 Not Found` rather than exposing the existence of another user's task.
- A stable error shape: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { } } }`.
- Date requests require an IANA timezone, for example `GET /tasks?date=2026-10-03&timeZone=Asia%2FKolkata`.
- Pagination is not required for the date-filtered MVP endpoint. Add it before broader list/search endpoints.

## 8. Frontend integration requirements

- Replace `localStorage` reads/writes with an API client layer; do not use browser storage for credentials or sessions. Keep optimistic interaction only if failures are safely reverted.
- The selected date should call `GET /tasks?date=…&timeZone=…` using `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Creation, editing, status toggles, and deletion should call the corresponding API route and update the UI from the server response.
- Show understandable loading, empty, and retry/error states.
- Decide whether the existing sample tasks remain a visual demo only, or are removed once a user has no saved tasks.

## 9. Security and operational requirements

- HTTPS in deployed environments; secrets supplied only through environment variables.
- Serve the public web application and API from the same site where possible. Otherwise use a strict CORS allow-list with no wildcard credentials policy and add CSRF protection for state-changing cookie-authenticated routes.
- Validate and normalize all input; do not return stack traces in production responses.
- Request logging with request ID, route, status, and duration; never log credentials, session identifiers, tokens, or task descriptions by default.
- Apply rate limits to auth routes and sensible general API limits.
- Automated tests for authentication, ownership, password-reset token handling, rate limiting, validation, CRUD behaviour, and date queries across timezones.
- Versioned database migrations and documented backup/recovery expectations.
- Establish a security-release process: dependency updates, secret rotation, vulnerability monitoring, audit logs for account-sensitive actions, and incident response contacts.

## 10. Delivery milestones

1. Restructure into the monorepo layout, then create the Express/TypeScript service with health endpoint, configuration, linting, and test setup.
2. Add account, session, and token schema; implement registration, login/logout, verification, reset, and auth security controls.
3. Add task schema, migrations, timezone-aware CRUD API, and automated tests.
4. Connect the React app, including account screens, loading states, and safe failure/retry handling.
5. Add deployment configuration, observability, public-launch security review, and end-to-end checks.

## 11. Decisions to make before implementation

| Decision | Options | Recommended starting point | Why it matters |
| --- | --- | --- | --- |
| API language | JavaScript or TypeScript | TypeScript | Shares types and validation concepts with the existing TypeScript frontend. |
| Database | PostgreSQL, SQLite, document database | PostgreSQL for production; SQLite only for local/testing if desired | Strong relational model, migrations, and reliable date/user queries. |
| Data access | SQL query builder, ORM, raw SQL | ORM or typed query builder | Balances speed with schema migrations and type safety. Choose based on team preference. |
| Authentication | Hosted provider, custom passwords, passwordless | First-party email/password auth | Product decision: no third-party authentication. It requires verification, reset, rate limiting, and operational ownership before launch. |
| Session style | Cookie session or bearer token | Opaque server-side sessions in secure HTTP-only cookies | Keeps credentials out of JavaScript and allows immediate server-side invalidation. |
| Validation | Library-based schemas or hand-written checks | Shared schema validation library | Keeps API input and frontend form rules consistent. |
| Hosting | Single service, separate frontend/API, serverless | Start with one API service plus managed Postgres | Simpler deployment and debugging; can split later. |
| Timezone policy | Fixed date vs instant that displays locally | Store a UTC task anchor and derive the displayed date in the current IANA timezone | Product decision: dates change when the user's timezone changes. |
| Delete policy | Hard delete or soft delete | Hard delete for MVP | Matches current UX; soft deletes are useful later for recovery/audit. |
| API contract | REST or GraphQL | REST | The initial CRUD surface is small and maps directly to the frontend. |

## 12. Open questions for product and technical design

1. What minimum password policy and account-recovery experience should users see? For a public app, email verification and password reset are required before launch.
2. For an unscheduled task, are you comfortable with the documented hidden noon anchor, which lets its day change when travelling? Or should unscheduled tasks be date-only and remain fixed?
3. Should completed tasks stay visible indefinitely in a day view, or be archived after a period?
4. Is a task always assigned to exactly one day, or will future work need due dates, labels, projects, priorities, and recurring schedules?

## 13. Proposed baseline architecture

`apps/web (React/Vite) → apps/api (Express JSON API) → PostgreSQL`

The API owns authentication, validation, authorization, timezone conversion, and database access. The frontend communicates only with the API, never the database directly.

Suggested repository layout:

```text
apps/
  web/                 # Existing React/Vite application
  api/                 # Express API, migrations, integration tests
packages/
  api-contract/        # Shared request/response types and validation schemas
  config/              # Shared TypeScript, lint, and test configuration
infra/                 # Local PostgreSQL/development deployment resources
docs/
```

The monorepo should use one package manager and workspace-aware scripts for development, linting, tests, and builds. Keep the API independently deployable, while sharing only framework-neutral contracts with the web app.
