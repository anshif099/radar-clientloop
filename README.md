# Radar ClientLoop

ClientLoop is Rainhopes' mobile-first client review, approval, revision, and publishing portal. The current milestone establishes the production application shell, installable PWA behavior, and PostgreSQL multi-tenant data foundation.

## Stack

- Next.js 16, React 19, and TypeScript.
- PostgreSQL as the application source of truth.
- Drizzle ORM types with explicit reviewed SQL migrations.
- Inter Variable plus Noto Sans Malayalam, self-hosted by the application.
- Vitest for domain tests and Playwright for responsive browser journeys.

Firebase Realtime Database is not used. Firebase Cloud Messaging may be evaluated later for push notifications, but PostgreSQL remains authoritative.

## Local development

Requirements: Node.js 20.9 or newer, npm, and PostgreSQL 18. Docker Compose is included as the simplest local PostgreSQL option.

```bash
npm install
docker compose up -d
copy .env.example .env.local
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. The health endpoint is available at `http://localhost:3000/api/v1/health`.

The current review feed uses local demonstration data while the authenticated API/repository layer is built. Review decisions made in this UI milestone are intentionally not persisted yet.

## Commands

```bash
npm run dev          # development server
npm run build        # optimized production build
npm run lint         # source linting
npm run typecheck    # TypeScript verification
npm run test         # domain unit tests
npm run test:e2e     # mobile and desktop browser journeys
npm run db:validate  # validate foundation migration in an embedded PostgreSQL engine
npm run db:migrate   # apply SQL migrations to DATABASE_URL
npm run pwa:assets   # regenerate install icons from the ClientLoop SVG
```

## PWA behavior

The production application registers `/sw.js`. It caches only versioned application-shell assets, install icons, and the generic offline page. API responses, client media, feedback, signed URLs, and token-bearing routes are explicitly excluded.

Install prompts require HTTPS in production. The normal responsive website remains fully functional in browsers that do not support PWA installation.

## Database isolation

The initial migration creates 15 foundation tables and 14 row-level security policies. Application queries must run inside `withAgency()`, which sets a transaction-local tenant context. Composite foreign keys prevent records from referencing resources in another agency.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the complete delivery roadmap.
