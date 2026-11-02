# Project Context

## Overview

This project is a backend REST API for managing appointments ("turnos") at a beauty center.

The application is responsible for:

* Listing services, professionals and which services each professional offers
* Generating available time slots for a date and a service
* Booking, modifying and cancelling appointments
* Registering professionals, validated against the external Users API

This API does **not** handle user registration or login. Users live in a separate Users API with its own database. This API only **verifies** the JWTs that the other API issues.

The project is built using Node.js and Express. Data is stored in Supabase (PostgreSQL). It is deployed on Vercel.

---

## Technology Stack

* Node.js 24.x (CommonJS, `require` / `module.exports`)
* Express 5
* Supabase (PostgreSQL) through `@supabase/supabase-js`
* `dotenv` for configuration
* JSON Web Token (JWT) through `jsonwebtoken`, verified locally
* Vercel (`@vercel/node`)

---

## Project Structure

The project follows a layered architecture:

```text
Routes
   ↓
Controllers
   ↓
Services (only for operations with business rules)
   ↓
Supabase client (config/supabase.js) / Users API
   ↓
Supabase / PostgreSQL
```

Simple listing endpoints (`servicios`, `profesionales`, `profesionalServicio`, `turnos`) call Supabase directly from the controller. Keep this for simple reads.

Operations with business rules (bookings, registering a professional) live in `src/services/`. A service returns `{ resultado: '<caso>', ...datos }` for every expected outcome (`'ok'`, `'no_encontrado'`, `'ocupado'`, ...), and throws on unexpected errors. The controller only maps each `resultado` to an HTTP status and message. Follow this pattern for new operations.

Protected endpoints go through middleware:

```text
Request
   ↓
Logger Middleware
   ↓
Auth Middleware (verify JWT, attach req.usuario)
   ↓
Validate Middleware
   ↓
Controller
   ↓
Supabase
   ↓
Error Middleware (on failure)
```

### Main files and directories

All source code lives under `src/`.

#### `server.js`

Entry point. Loads `.env` and starts the HTTP server (default port `3001`).

#### `app.js`

Creates the Express app, registers global middleware and mounts routers under `/api/...`.

#### `routes/`

Defines the API endpoints, connects them with controllers and applies route-level middleware. One file per resource: `<recurso>Routes.js`.

#### `controllers/`

Handles HTTP requests and responses. One file per resource: `<recurso>Controller.js`.

#### `services/`

Business logic and external integrations:

* `reservaService.js`: list the user's bookings, and create, modify and cancel bookings.
* `profesionalService.js`: register a professional.
* `usuariosApiService.js`: the **only** place that calls the Users API.

#### `utils/`

Small shared helpers. `fechas.js` exposes `fechaHoy()`, today's date in the center's time zone (`America/Argentina/Buenos_Aires`). The server runs in UTC, so always use `fechaHoy()` instead of `new Date()` to compare against `TURNO.fecha`.

#### `middlewares/`

Contains Express middleware (`<nombre>Middleware.js`):

* `loggerMiddleware.js`: logs method and URL.
* `authMiddleware.js`: `verificarJWT` (→ `401`) and `requerirRol(...roles)` (→ `403`).
* `validateMiddleware.js` (→ `400`). Available types: `enteroPositivo`, `texto`, `fecha`. Add new types to the `validadores` object instead of validating inline in controllers.
  * `validarBody({ campo: 'tipo' })`: JSON body, all fields required. Numbers must be JSON numbers, not strings.
  * `validarParams({ id: 'enteroPositivo' })`: route params, all required, validated as strings.
  * `validarQuery({ campo: 'tipo' })`: query string, all optional, only validated when present.
* `errorMiddleware.js`: centralized error handler, registered last in `app.js`. Answers `400` for malformed JSON and `500` for everything else.

#### `config/`

Contains configuration for external services. `supabase.js` creates the **single** Supabase client used across the app.

#### `docs/`

Contains the project documentation (see [Documentation](#documentation)).

---

# Language and Naming Conventions

* Code identifiers, response messages and comments are in **Spanish**. Examples: `obtenerServicios`, `generarTurnos`, `mensaje`.
* Controller functions follow a `verbo + Recurso` pattern: `obtenerX`, `generarX`, `crearX`, `cancelarX`.
* Database tables are **UPPERCASE**: `SERVICIO`, `PROFESIONAL`, `PROFESIONAL_SERVICIO`, `TURNO`.
* Database columns are **snake_case**: `profesional_id`, `hora_inicio`.
* Request and response bodies use the same snake_case names as the database columns.

---

# Authentication

Authentication is implemented in `src/middlewares/authMiddleware.js`, following the sequence diagrams in `src/docs/diagrams/`. Apply it per route:

```js
router.post('/generar', verificarJWT, requerirRol('administrador'), validarBody({...}), generarTurnos);
```

## Protected endpoint flow

```text
Client
   ↓
Authorization: Bearer <JWT>
   ↓
Auth Middleware
   ↓
Verify signature (HS256) and expiration locally (no call to the Users API)
   ↓
Read claims { id, rol } and attach { usuario_id: id, rol } to req.usuario
   ↓
Role check when required (e.g. 'administrador')
   ↓
Controller
```

* The Users API puts the user's MongoDB ObjectId in the `id` claim, not `usuario_id` as the diagrams suggest. Inside this API it is always called `usuario_id`.
* The Users API answers `GET /interno/usuarios/{id}` with `{ nombre, apellido, rol, activo }`, or `404` if the user does not exist.
* Invalid or missing JWT → `401 unauthorized`
* Valid JWT but wrong role → `403 forbidden`

## Service-to-service flow

When this API calls the Users API (for example, to register a professional):

```text
API de turnos
   ↓
GET /interno/usuarios/{usuario_id}
   ↓
X-API-Key: <API_KEY_INTERNA>
   ↓
API de usuarios
```

Never forward the user's JWT to the Users API. Use the internal API key.

### Authentication rules

* Protected endpoints must use the authentication middleware.
* JWT verification must be handled only by the authentication middleware.
* Controllers must read user identity from `req.usuario` and must not decode tokens themselves.
* Controllers must take the `usuario_id` from the JWT, never from the request body.
* Do not duplicate authentication logic across controllers or services.
* Never log tokens, API keys or Supabase keys.
* Reuse the existing authentication implementation before creating new authentication utilities.
* Administrative operations (generating slots, registering professionals) require the `administrador` role.

---

# Supabase

Supabase is the application's only database.

Before modifying Supabase-related code:

1. Inspect `src/config/supabase.js`.
2. Check the data model in `src/docs/database/DER turnos.jpeg`.
3. Identify which controllers query the affected tables.
4. Reuse the existing client from `config/supabase.js`.
5. Never call `createClient` anywhere else.

### Data model rules

* `TURNO` represents a time slot of one professional.
* `TURNO.estado` is either `disponible` or `reservado`.
* `TURNO.usuario_id` and `TURNO.servicio_id` are `null` while the slot is `disponible`.
* `PROFESIONAL.usuario_id` is a **logical** reference to the Users API, not a foreign key.
* `PROFESIONAL.usuario_id` and `TURNO.usuario_id` are **text** in the database, even though the DER says `int`. They store the Users API identifier, a MongoDB ObjectId. Treat them as strings and validate them with the `texto` type.
* Professionals created before `001_reservas.sql` have `usuario_id = null`.
* `PROFESIONAL` has an `activo` column (not in the DER). Listings show only `activo = true`. New professionals are created with `activo = true`.
* Before relying on a column, check the real schema, not only the DER: they have diverged before.
* `TURNO` has no foreign keys defined in the database, so Supabase embedding (`select('*, SERVICIO(...)')`) does not work. To include related data, query the related tables with `.in('id', ids)` and merge in code (see `obtenerReservas` in `reservaService.js`).
* There is no `USUARIO` table in this database. Users live in the Users API.
* Before filtering by a column such as `activo`, check that the column exists in the DER.

### Concurrency rules

A state change on a slot (booking, modifying, cancelling) must use a **conditional update** that checks the current state. Then check how many rows changed:

```js
const { data, error } = await supabase
    .from('TURNO')
    .update({ estado: 'reservado', usuario_id, servicio_id })
    .eq('id', turno_id)
    .eq('estado', 'disponible')
    .select();

// data.length === 0 → another request took it first → 409
```

Do not use a separate SELECT followed by an unconditional UPDATE for state changes.

When an operation needs several writes that must all succeed or all fail, use a Postgres function called through `supabase.rpc(...)`. Example: `modificar_reserva`, which returns `jsonb` with the same `{ resultado, ... }` shape as the services.

### Database changes

Supabase schema changes are kept as numbered SQL scripts in `src/docs/database/` (`001_reservas.sql`, ...), to be run manually in the Supabase SQL Editor. Do not edit a script that may already have been run; add a new numbered script instead. Mention in the final report that the user has to run it.

Current constraints (from `001_reservas.sql`):

* `TURNO.estado` must be `disponible` or `reservado`.
* Unique `(profesional_id, fecha, hora_inicio)` in `TURNO`.
* Unique `usuario_id` in `PROFESIONAL` (duplicate insert → Postgres code `23505` → `409`).

Never hardcode Supabase credentials. Use the environment variables.

---

# Business Rules

Rules for generating slots (`POST /api/turnos/generar`):

* Monday to Friday only.
* Working hours from 09:00 to 18:00, the same for every professional. A slot must end within working hours.
* The slot length is `SERVICIO.duracion` in minutes, between 1 and 480.
* All services currently last 60 minutes, so every slot is one hour long and any service a professional offers fits in any of their slots. Booking does not need to check whether the service fits the slot. If services with other durations are added, revisit this rule.
* Slots are created only for professionals with an active `PROFESIONAL_SERVICIO` relation to the service.
* A new slot must not overlap an existing slot of the same professional on the same date.

Rules for bookings, from the sequence diagrams:

* A slot can only be booked if it is `disponible` and the professional offers the requested service (`PROFESIONAL_SERVICIO.activo = true`).
* A user can only modify or cancel their own bookings.
* A modification must keep the same professional.

Additional rules not in the diagrams:

* Slots from past dates (`fecha < fechaHoy()`) cannot be booked or used as the new slot in a modification, and are not listed.
* In a modification, the new slot must be different from the current one (`400`).
* Booking routes are unified under `/api/reservas` (the diagrams mix `/reservas` and `/reserva/{id}`).

If a requested change contradicts these rules or the diagrams, point out the conflict before implementing it.

---

# Coding Rules

Before implementing a new feature:

1. Inspect the existing architecture.
2. Read the relevant sequence diagram in `src/docs/diagrams/` if one exists.
3. Identify related routes, controllers and middleware.
4. Reuse existing functions and utilities whenever possible.
5. Follow the existing naming conventions.
6. Follow the existing project structure.
7. Avoid introducing unnecessary dependencies.
8. Do not restructure the application unless explicitly requested or clearly necessary.

---

# Controllers

Controllers are responsible for:

* Reading request data (`req.body`, `req.params`, `req.query`, `req.usuario`).
* Querying Supabase, or calling a service when one exists.
* Returning HTTP responses with the correct status code.

Controllers should NOT contain authentication or significant reusable business logic.

Export controllers as named functions:

```js
module.exports = {
    obtenerTurnos,
    generarTurnos
};
```

---

# Routes

Routes are responsible for:

* Defining API endpoints.
* Connecting endpoints with controllers.
* Applying the appropriate middleware (auth, role, validation).

Every new router must be mounted in `src/app.js` under `/api/<recurso>`.

---

# Middleware

Middleware is responsible for cross-cutting concerns such as:

* Request logging.
* JWT authentication.
* Authorization by role.
* Request format validation (→ `400`).
* Centralized error handling.

---

# API Changes

When adding or modifying an endpoint:

1. Inspect similar existing endpoints first.
2. Check the sequence diagrams for the expected URL, method and status codes.
3. Follow existing URL conventions (`/api/<recurso>`).
4. Use the existing route/controller/middleware architecture.
5. Apply authentication middleware when required.
6. Maintain consistent HTTP status codes.
7. Maintain the existing response structure.
8. Do not break existing endpoints unless explicitly requested.
9. Update the endpoint tables in `README.md`.

### Status codes used in the project

| Code | Meaning |
|---|---|
| `200` | OK, including "nothing to do" cases |
| `201` | Resource created or slot booked |
| `400` | Invalid request format or invalid input |
| `401` | Missing or invalid JWT |
| `403` | Valid JWT but insufficient role |
| `404` | Resource not found, or it does not belong to the user |
| `409` | Conflict: slot already taken, or professional already registered |
| `422` | Valid format but violates a business rule |
| `500` | Database or internal error |

---

# Error Handling

All error responses use this format:

```json
{
  "mensaje": "Descripción legible del error",
  "error": "Detalle técnico (opcional)"
}
```

Existing controllers still use their own `try/catch`. For new code, prefer throwing (or `next(error)`) from async handlers: Express 5 forwards rejected promises to `errorMiddleware.js`, which logs the error and returns a generic `500` without internal details.

Before introducing a new error-handling mechanism:

* Inspect how existing controllers handle errors.
* Reuse the error middleware once it exists.
* Maintain consistent HTTP status codes.
* Maintain the existing response format.
* Do not expose stack traces to clients.
* Do not expose credentials, tokens or other sensitive information.

---

# Environment Variables and Secrets

Configuration is loaded from a `.env` file at the project root, which is excluded by `.gitignore`.

| Variable | Status | Purpose |
|---|---|---|
| `SUPABASE_URL` | in use | Supabase project URL |
| `SUPABASE_KEY` | in use | Supabase key |
| `PORT` | in use | HTTP port (default `3001`) |
| `JWT_SECRET` | in use | Verify JWTs issued by the Users API |
| `USUARIOS_API_URL` | in use | Base URL of the Users API |
| `API_KEY_INTERNA` | in use | Service-to-service key for the Users API |

Never hardcode:

* JWT secrets
* Supabase keys
* Internal API keys
* Passwords
* Other sensitive configuration

When adding a new variable, document it in `README.md` and in this table.

Never commit secrets to Git.

---

# Testing

There is no test setup yet. `npm test` is a placeholder.

When implementing a new feature:

1. Identify existing tests related to the functionality, if any.
2. If adding a test framework, propose it first and do not add the dependency without approval.
3. Test successful scenarios.
4. Test failure scenarios (`400`, `401`, `403`, `404`, `409`, `422`).
5. Test concurrency-sensitive flows (two requests booking the same slot).
6. Until tests exist, verify manually by running `npm start` and calling the endpoints.

Do not remove tests simply because they fail.

If expected behavior has intentionally changed, update the tests accordingly.

---

# Working Process

For non-trivial changes, follow this process.

## Step 1 — Analyze

First inspect the relevant code and documentation.

Do not modify files yet.

Identify:

* Existing implementation.
* Related routes.
* Controllers.
* Middleware.
* Supabase tables involved.
* The relevant sequence diagram and the DER.
* Authentication requirements.
* Existing tests.

## Step 2 — Plan

Before implementing a significant feature, provide a short implementation plan.

The plan should include:

* Files to modify.
* Files to create.
* Existing code that will be reused.
* API changes.
* Database changes (tables, columns, constraints, Postgres functions) if applicable.
* Any difference from the sequence diagrams.
* Tests that should be added or modified.

## Step 3 — Implement

After the approach is clear, implement the feature.

Follow the existing architecture and coding conventions.

Avoid unrelated refactoring.

## Step 4 — Validate

After implementation:

* Run tests if available.
* Start the server and check the affected endpoints.
* Review the modified files.
* Check for authentication and security issues.
* Check for unintended changes.
* Update `README.md` if endpoints, variables or setup changed.

Report any problems that could not be resolved.

---

# Change Log

The project maintains a high-level change log in:

```text
CHANGELOG.md
```

Update `CHANGELOG.md` after completing a significant change.

The changelog should describe changes at a high level.

Do NOT list individual file changes or implementation details.

Update the changelog for:

* New features.
* New API endpoints.
* Significant changes to existing functionality.
* Authentication changes.
* Supabase / database schema changes.
* Integration changes with the Users API.
* Significant bug fixes.
* Security-related changes.
* Relevant architectural changes.

Do NOT update the changelog for trivial changes such as:

* Variable renaming.
* Formatting.
* Minor refactoring.
* Small internal code cleanup.
* Comment changes.

Each entry should include:

* Date.
* Category.
* Short description.

Use these categories:

* Added
* Changed
* Fixed
* Removed
* Security

Example:

```md
## 2026-11-05

### Added

- Added appointment booking endpoint.
- Added JWT authentication for protected endpoints.

### Fixed

- Fixed slot generation creating overlapping slots for the same professional.
```

---

# Documentation

Project documentation is located in:

```text
src/docs/
├── database/
│   ├── DER turnos.jpeg      # Entity-relationship diagram
│   └── 001_reservas.sql     # Constraints and modificar_reserva function
├── API-frontend.md          # Integration guide for the frontend team (Spanish)
└── diagrams/                # Sequence diagrams (PlantUML)
    ├── Diagrama reserva turno.puml
    ├── Diagrama modificacion turno.puml
    ├── Diagrama cancelacion turno.puml
    └── Diagrama registro profesional en turnos.puml
```

User-facing setup and endpoint documentation is in `README.md`. When endpoints change, also update `src/docs/API-frontend.md`.

The sequence diagrams are the reference for the booking and professional registration endpoints. Before changing them, read the corresponding diagram.

If the implementation has to differ from a diagram, say so and update the diagram when appropriate.

---

# Git Safety

Use Git as the project's source-control and change-tracking system.

Before significant changes:

* Inspect the current Git status.
* Review existing changes before modifying files.
* Keep changes focused on the requested functionality.

Do NOT execute destructive commands such as:

```text
git reset --hard
git clean -fd
git push --force
```

unless explicitly requested by the user.

Do not discard existing user changes.

---

# General Principle

Prefer:

```text
Understand existing code and diagrams
        ↓
Reuse existing patterns
        ↓
Make the smallest necessary change
        ↓
Test
        ↓
Review
        ↓
Update README.md / CHANGELOG.md
```

over:

```text
Rewrite
Refactor everything
Add unnecessary dependencies
Change unrelated code
```

The primary goal is to add functionality while preserving the existing architecture, behavior and stability of the application.
