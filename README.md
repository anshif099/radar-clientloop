# Radar ClientLoop

ClientLoop is Rainhopes' mobile-first content review portal. It uses a Next.js 16 server, Better Auth, MariaDB/MySQL, and private filesystem storage for uploaded content.

## Supported content

The upload dialog includes Image, Video, PDF, Word, Excel, and Website link options. The file picker changes to match the selected type; Website link shows a URL field.

- Images: JPG, PNG, WebP, GIF (20 MB), displayed inline with a display-only ClientLoop watermark.
- Videos: MP4, WebM, MOV, M4V (100 MB), with playback controls and byte-range streaming for seeking. Playback depends on browser codec support; the original file can also be downloaded.
- PDFs: PDF (20 MB), with an embedded viewer and an Open PDF fallback.
- Word: DOC, DOCX (20 MB), with a download card.
- Excel: XLS, XLSX (20 MB), with a download card.
- Websites: HTTP/HTTPS URLs up to 2,048 characters, opened in a new tab through an authenticated asset route.

All types use the same review and version history. Website URLs are stored as private URI-list assets. Downloads serve the original file bytes. Set the hosting proxy's request body limit above 100 MB (including multipart overhead) to allow the maximum video upload size.

## Categories and subcategories

Uploads require a category and one of its subcategories, independently of file type:

- Graphic Design: Logo Branding, Package Designs, Social Media Creatives, Digital Ad Banners, OOH Designs, Leaflets, Brochures, Magazines.
- UI/UX: UI/UX Wireframes, Web/App Prototypes, Web/App Mockups.
- Video: Video Storyboards, Visual Scripts, Video Mockups.
- Content Design: Copy Articles, Blog Copy.

Category and subcategory filters are available in the admin project view and the company Review, Dashboard, and Downloads views. They combine with the existing project, date, and status filters. Choosing a different category resets the subcategory filter. Classification belongs to the work item; uploading a revision prefills its saved values and allows changing them.

**Before starting the updated app, run `npm run db:migrate` against the application's MySQL/MariaDB database.** Migration `0003_work_categories.sql` adds nullable category and subcategory columns. Existing items remain available under All categories and Uncategorized until classified when uploading a new version.

## Data and security model

- Better Auth users, passwords, and sessions are stored in the same MariaDB/MySQL database as the application data.
- Public registration is disabled. The first Super Admin is created by the controlled `auth:bootstrap` command.
- Company-facing reads and writes require authenticated identity resolution plus explicit company and workspace predicates.
- Poster files are kept outside the web root. MySQL stores their metadata and authorization relationship, not image BLOBs.
- Private poster images are streamed through an authenticated API route; storage paths are never sent to the browser.
- Audit records are append-only at both the application and database-trigger layers.

MariaDB does not provide PostgreSQL-style row-level security. Every new company-facing repository function must therefore include `agencyId` and `workspaceId` predicates, and must be covered by a negative cross-company test.

## Local setup

Requirements: Node.js 20.9 or newer, npm, and MariaDB 10.11/MySQL 8. Docker Compose can provide the local database.

1. Install packages and create the local environment file.

```powershell
npm install
Copy-Item .env.example .env.local
```

2. Set a real `BETTER_AUTH_SECRET`, Super Admin credentials, and `UPLOAD_ROOT` in `.env.local`.

```powershell
New-Item -ItemType Directory -Force var/uploads
```

3. Start MariaDB, migrate, bootstrap, and run the app.

```powershell
docker compose up -d
npm run db:validate
npm run db:migrate
npm run auth:bootstrap
npm run dev
```

4. Open `http://localhost:3000/login` and sign in with the bootstrapped administrator.

The bootstrap is idempotent. After production bootstrap, remove `SUPER_ADMIN_PASSWORD` from the long-running application environment and retain it only in a password manager.

## Commands

```bash
npm run dev            # development server
npm run build          # optimized production build
npm run start          # production Node.js server
npm run lint           # source linting
npm run typecheck      # TypeScript verification
npm run test           # domain unit tests
npm run test:e2e       # browser tests
npm run db:validate    # static MySQL migration and tenant-guard checks
npm run db:migrate     # apply SQL migrations to DATABASE_URL
npm run auth:bootstrap # create the environment-configured Super Admin
```

For Spaceship/cPanel production deployment, follow [CPANEL_DEPLOYMENT.md](./CPANEL_DEPLOYMENT.md).
