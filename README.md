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

## Company chat and ClientLoop AI Ultra

Open **Messages & AI** from the admin workspace, or **Messages** from the company portal. Admins select a company; its users can only access their own company's room. Messages refresh every three seconds, remain available after reload, and older history loads in pages. Retrying a failed send reuses its message identifier to prevent duplicates.

Company chat supports text, images, videos, voice recordings, PDFs, Word/Excel documents, UTF-8 text/CSV, and ZIP files. Attach up to five files totaling 100 MB per message: images/documents/text up to 20 MB each, audio up to 25 MB, videos/ZIP up to 100 MB. Voice recording needs HTTPS (or localhost), microphone permission, and a compatible browser; recording stops at five minutes. Media playback depends on browser codecs. Unsupported files can be shared in a ZIP archive; archives are downloaded without extraction.

Run `npm run db:migrate` before using chat. Migration `0004_chat_and_local_ai.sql` creates threads, messages, and attachments. Text, timestamps, senders, AI reports, and attachment metadata/checksums are saved in MySQL/MariaDB. File bytes are saved under private `UPLOAD_ROOT`, outside the public web root. Back up both the database and upload directory to retain complete history. Company closure preserves stored history but disables access. No message-deletion endpoint or automatic history expiry is provided.

**AI Ultra is a real open-source language model that runs inside each user’s browser with WebGPU.** It uses WebLLM and Qwen3.5 2B; it does not use OpenAI, an API key, or remote inference. On first use the browser downloads the model files and caches them locally. Later questions reuse that cache. A current WebGPU-capable Chrome or Edge browser over HTTPS and sufficient graphics memory are required.

The cPanel application remains responsible for authentication and safe MySQL retrieval. It sends the browser a bounded snapshot containing complete status counts plus authorized company names, projects, recent posts, published versions, client-visible feedback, and the selected post’s details. The model receives no passwords, authentication tokens, storage paths, checksums, or internal-only feedback. Company users remain restricted to their company; admins receive only the company scope they selected. The model never receives raw SQL and cannot change approvals or other records.

Questions are not matched to hardcoded reply templates. Users can write naturally, including informal English and spelling mistakes, ask follow-up questions, or ask general-knowledge questions from the model’s built-in knowledge. Database facts are authoritative for ClientLoop answers. Exact counts are complete, while long detail lists are limited to the newest records and the assistant is instructed to disclose that limit. Select **Post to discuss** to include that post’s versions, client reviews, feedback, and safe file metadata. This text-only model does not inspect the pixels, pages, audio, or video inside uploaded files.

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
