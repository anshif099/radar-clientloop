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

## Company chat, writing correction, and revision checks

Open **Messages** from either workspace. Admins select a company; its users can only access their own company's room. Messages refresh every three seconds, remain available after reload, and older history loads in pages. Retrying a failed send reuses its message identifier to prevent duplicates.

Company chat supports text, images, videos, voice recordings, PDFs, Word/Excel documents, UTF-8 text/CSV, and ZIP files. Attach up to five files totaling 100 MB per message: images/documents/text up to 20 MB each, audio up to 25 MB, videos/ZIP up to 100 MB. Voice recording needs HTTPS (or localhost), microphone permission, and a compatible browser; recording stops at five minutes. Media playback depends on browser codecs. Unsupported files can be shared in a ZIP archive; archives are downloaded without extraction.

Super Admins can permanently delete an individual version from its Version history row. Deleting the current version promotes the newest remaining version; deleting the only version uses the whole-poster confirmation instead. The poster-level trash button removes every version, review decision, feedback entry, database asset record, and stored poster file. These operations cannot be undone.

Run `npm run db:migrate` before using chat. Migration `0004_chat_and_local_ai.sql` creates threads, messages, and attachments. Text, timestamps, senders, and attachment metadata/checksums are saved in MySQL/MariaDB. File bytes are saved under private `UPLOAD_ROOT`, outside the public web root. Back up both the database and upload directory to retain complete history. Company closure preserves stored history but disables access. No message-deletion endpoint or automatic history expiry is provided.

The writing and revision tools run entirely in application code. They use no AI provider, external API, API key, or network request. The English spelling checker uses a local dictionary installed with the application.

**Fix spelling & grammar** is available for chat messages, client feedback, poster titles, and upload notes. Browser spellcheck remains enabled while typing. After a short typing pause, the local English dictionary offers tappable alternatives for the last word (for example, `appl` offers `apple`); no external service or hard-coded typo list is used. The grammar check shows a preview and only changes the field when the user chooses **Apply correction**. Malayalam and mixed-language text is preserved, but the rules do not attempt Malayalam grammar correction.

After an admin uploads a revised version, **Check requested changes** compares the newest file with the latest earlier version that received written client changes or rejection feedback. It checks exact bytes and file metadata; images also receive dimension and sampled-pixel comparison with a changed-region estimate. Hard-coded rules can verify dimensions, orientation, format, and file-size requests. Subjective requests such as object, color, or copy changes are marked `Uncertain` for human confirmation. Files are limited to 45 MB combined. The result is advisory and does not approve content or alter records.

For local setup, `DATABASE_URL` must use `mysql://` with a reachable MySQL/MariaDB server; a PostgreSQL/Neon URL cannot be used by this application. Set `UPLOAD_ROOT` to an existing writable private directory (absolute in production), and allow more than 100 MB including multipart overhead through the hosting proxy.

`npm run test:chat-ui` runs desktop/mobile browser checks against a standalone UI fixture with mocked chat responses, including real browser microphone recording from a synthetic device. It does not replace database-backed integration testing. The fixture is separate from the Next.js application and adds no authentication bypass. These development browser checks require Node 20.19+ or 22.12+ and installed Chrome.

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
