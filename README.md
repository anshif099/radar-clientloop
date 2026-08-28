# Radar ClientLoop

ClientLoop is Rainhopes' mobile-first, installable poster review portal. It now uses real authenticated accounts and persistent tenant-scoped data; the application does not seed or render demonstration companies or posters.

## Database decision

PostgreSQL is the system of record. Firebase Realtime Database is not required and is not used.

PostgreSQL fits the approval workflow because companies, users, memberships, posters, versions, reviews, files, and immutable audit events are relational. Row-level security (RLS) also provides a database-enforced tenant boundary. Poster files live in private S3-compatible object storage; their metadata and permissions remain in PostgreSQL.

## Implemented access model

- Super Admin accounts have the Better Auth role `admin` and can create, edit, and delete companies, add projects, and publish posters under those projects.
- Creating a company creates its tenant, private workspace, company user, membership, and login credentials in one controlled workflow.
- Company accounts resolve to exactly one active company before any application data is queried.
- Every company query runs through `withAgency()`, which sets a transaction-local tenant ID used by PostgreSQL RLS.
- Private poster images are streamed through an authenticated endpoint. Object-storage keys are never exposed to the browser.
- Public registration is disabled. Super Admin creation is an explicit environment-backed bootstrap command.

## Local setup

Requirements: Node.js 20.9 or newer, npm, Docker Desktop (or your own PostgreSQL and S3-compatible services).

1. Install packages and create the local environment file.

```powershell
npm install
Copy-Item .env.example .env.local
```

2. Edit `.env.local` before bootstrapping:

- Set `BETTER_AUTH_SECRET` to at least 32 random characters.
- Set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME`, and a strong `SUPER_ADMIN_PASSWORD` of at least 12 characters.
- Keep the included S3 values for the local MinIO service, or replace them with private production object-storage credentials.

3. Start PostgreSQL and MinIO, migrate the database, and create the Super Admin.

```powershell
docker compose up -d
npm run db:migrate
npm run auth:bootstrap
npm run dev
```

4. Open `http://localhost:3000/login` and sign in with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `.env.local`.

The bootstrap command is idempotent: if that Super Admin already exists, it does not create another. Credentials are not hardcoded into the client bundle or committed source. Passwords are hashed by Better Auth before storage.

`SUPER_ADMIN_PASSWORD` is needed only by the bootstrap command. After a successful production bootstrap, remove that plaintext value from the long-running application environment and retain the password only in an approved password manager.

## Super Admin workflow

After login:

1. Select an existing company, or use **Add company** to enter the company name, login email, and initial password.
2. Securely send those credentials to that company. The selected company's name and login email can be edited; deleting it disables its login while retaining audit history.
3. Add or select a project under the selected company.
4. Use **Add poster** to select that project, add poster details, and upload a JPG, PNG, WebP, or GIF up to 20 MB.
5. The company signs in at `/login` and sees only posters belonging to its tenant, grouped by project name.

Company review actions—Approve, Request changes, and Reject—are persisted against the current poster version with an audit event and notification outbox event.

## Commands

```bash
npm run dev          # development server
npm run build        # optimized production build
npm run lint         # source linting
npm run typecheck    # TypeScript verification
npm run test         # domain unit tests
npm run test:e2e     # mobile and desktop browser tests
npm run db:validate  # migrations plus negative cross-tenant RLS test
npm run db:migrate   # apply SQL migrations to DATABASE_URL
npm run auth:bootstrap # create the environment-configured Super Admin
npm run pwa:assets   # regenerate PWA icons
```

## Production notes

- Use managed PostgreSQL and a private S3-compatible bucket with encryption and backups.
- The application database role must be `NOSUPERUSER` and must not have `BYPASSRLS`; PostgreSQL superusers bypass tenant policies. The local Compose initialization creates the correct non-superuser `clientloop` role.
- Use HTTPS, a unique production `BETTER_AUTH_SECRET`, and production-only credentials.
- Do not reuse the local MinIO credentials outside local development.
- Run migrations and `auth:bootstrap` as controlled deployment jobs, not on every application startup.
- The service worker does not cache API responses or private company media.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the broader phased roadmap.
