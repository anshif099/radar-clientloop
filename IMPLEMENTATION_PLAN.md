# Radar ClientLoop — Implementation Plan

Status: In progress  
Prepared for: Rainhopes  
Baseline: Product & Technical Specification v1.0  
Plan date: 27 August 2026

Implementation checkpoint — 27 August 2026:

- Completed the Next.js/TypeScript foundation and initialized Git.
- Completed the Instagram-inspired mobile-first review-feed vertical slice and desktop adaptations.
- Completed locally hosted Inter/Noto typography, base PWA manifest/icons, safe service worker, offline page, and install/update controls.
- Completed the initial PostgreSQL/Drizzle schema, explicit migration, composite tenant keys, forced RLS policies, immutable audit trigger, and domain state machine.
- Added unit, exact-width mobile/desktop browser, manifest, migration, lint, type, build, and dependency-audit verification.
- Next implementation milestone: internal authentication, portal-token exchange/session, database-backed review API, direct object-storage upload, and transactional audit/outbox persistence. The current review UI still uses demonstration data.

## 1. Outcome

Build ClientLoop as a secure multi-tenant review, approval, revision, and publishing platform. Ship it first as a Rainhopes internal product, validate it with real clients, and then add the commercial controls required to sell the same codebase to other agencies.

The first production release must replace the core WhatsApp approval loop. It does not need to contain every SaaS, analytics, or AI feature. Tenant isolation, auditability, version integrity, and secure file access are foundation work and must not be deferred.

## 2. Current repository assessment

The repository is a Vite starter containing React 19 and static demo assets. It currently has no routing, API, database, authentication, storage integration, tests, CI/CD, or deployable product structure. There is also no Git metadata in the current workspace.

Treat the build as greenfield. Preserve any useful visual experiments as design references, but do not build production functionality on the current starter structure.

## 3. Delivery assumptions and recommended product decisions

These defaults let implementation begin. Product owners can change them during Phase 0.

| Topic | Recommended default |
| --- | --- |
| Client reviewers | Model multiple named client contacts now. MVP uses an `ANY_AUTHORIZED_REVIEWER` approval policy; quorum and all-reviewer policies are later features. |
| Rejection behavior | A rejection is a review decision, not a terminal work-item state. Both Reject and Request Changes move the item into `REVISION_REQUIRED` until a new version is submitted or a PM closes it. |
| Rejected version visibility | Keep prior versions and decisions visible in the client timeline. Do not show internal-only notes or superseded file download links unless policy permits them. |
| File retention | Retain while the agency account is active for the internal MVP. Add configurable retention, legal hold, export, and deletion before public SaaS launch. |
| Primary notifications | In-app plus email. Add WhatsApp and Slack only after the core delivery pipeline is reliable. |
| Showcase consent | Default off per client. Publishing requires explicit client/workspace consent and an item-level publish action. |
| Approval authority | Only the current version can be decided. A new version makes every older decision historical. Reopening an approved item requires PM/Admin permission and an audit reason. |
| Client authentication | Friendly workspace slug plus an unguessable, revocable access secret. Optional email OTP upgrades the portal session for sensitive workspaces. |
| Historical WhatsApp content | Do not bulk-import chats for MVP. Allow a PM to upload final historical assets and label them as imported. |
| Visual direction | Use an Instagram-inspired, media-first feed and familiar mobile navigation, adapted to ClientLoop branding and approval tasks rather than copied pixel-for-pixel. |
| Typography | Use Inter Variable as the production UI font, with Noto fallbacks for Indian scripts. Use Instagram Sans only if Rainhopes obtains explicit commercial web/app embedding rights. |
| Responsive strategy | Design from 320 px mobile screens upward, then enhance tablet, desktop, and wide-screen layouts with the same component system. |
| Installability | Deliver the client portal and internal workspace as an installable PWA with tenant-aware branding. Offline mode is a safe shell/status experience, not offline editing or caching of private files. |

The supplied screen appendix lists 22 screen entries, or 21 unique screens after removing the duplicated client showcase page. Estimates in this plan use 21 unique screens, not 16.

## 4. Scope by release

### Internal MVP

Included:

- Agency, client workspace, team membership, and seeded roles.
- Internal sign-in and scoped access.
- Secure client portal link with optional OTP support in the data model.
- Work-item creation, assignment, draft upload, and publish-to-client.
- Immutable versions with image, PDF, common video, audio, and reference attachments.
- Approve, Request Changes, and Reject actions.
- UTF-8 text feedback, browser voice capture, file/reference upload, and links.
- Current-state and historical timeline views.
- In-app and email notifications.
- Basic client and agency counts.
- Approved-file download through short-lived signed URLs.
- Audit trail, security controls, monitoring, backup, and recovery basics.
- Instagram-inspired mobile-first design system with polished tablet and desktop layouts.
- Installable PWA manifest, icons, safe service worker, update flow, and install guidance.

Explicitly deferred:

- Billing, plan enforcement, self-serve agency onboarding, and custom domains.
- Editable role/permission settings UI; MVP uses seeded role templates while the authorization engine remains data-driven.
- Public showcase and social/print handoff.
- Translation, transcription, digests, WhatsApp, and Slack.
- Advanced turnaround/revision analytics and SLA automation.
- Physical database isolation per agency.

### Operational release

Add version-rich dashboards, SLA/stalled queues, editable permissions, public showcases, social/print handoff, advanced filters, and reports.

### Automation release

Add transcription, translation, reminder policies, digest generation, and automated social handoff behind agency-level feature flags.

### SaaS release

Add self-serve tenancy, subscriptions and entitlements, white-label branding, subdomains/custom domains, quotas, lifecycle controls, and SaaS operations.

## 5. Target architecture

Use a TypeScript modular monolith with a separately deployed background worker. This is faster to ship and easier to operate than microservices while preserving clear module boundaries for future extraction.

```text
Client portal / Team app / Public showcase
                   |
       Next.js application + REST API
         |          |             |
    PostgreSQL   Object store   Redis/queue
         |          |             |
      RLS/data   private files   Worker process
                                 |  |  |
                              email AI webhooks
```

Recommended baseline:

- Web and server: Next.js App Router, React, and TypeScript.
- API: versioned REST endpoints and server-side command/query services. Do not introduce GraphQL until a concrete consumer needs it.
- Database: PostgreSQL with SQL migrations, composite tenant keys, and row-level security. Use Drizzle as the thin typed query/migration layer; keep security policies in reviewed SQL migrations.
- Object storage: private S3-compatible buckets with presigned multipart upload and short-lived download URLs.
- Background work: Redis-backed durable queue plus a separate worker for notifications, media processing, reminders, digests, transcription, and translation.
- Internal authentication: a managed, OIDC-capable identity provider selected in Phase 0, with MFA enforcement support. Keep application roles and workspace memberships in ClientLoop rather than relying on provider organization roles.
- UI: accessible component primitives plus application-owned design tokens for white-label themes.
- Experience: Instagram-inspired media feed, mobile bottom navigation, desktop navigation rail, responsive detail panels, and touch-first approval controls.
- PWA: tenant-aware web app manifest, install assets, standalone display mode, and a deliberately limited service worker that never caches private media or signed URLs.
- Email: transactional provider behind an adapter. Store provider message IDs and delivery state.
- Observability: structured logs, error tracking, traces, metrics, uptime checks, and tenant-safe correlation IDs.
- Hosting: managed Next.js-compatible compute plus managed PostgreSQL, Redis, and object storage. Keep provider-specific domain and storage calls behind adapters.

The Next.js App Router supports the UI and server route-handler model, while Vercel's platform documentation demonstrates single-deployment subdomain and custom-domain routing. PostgreSQL row-level security provides default-deny row access when enabled and properly configured. S3 presigned URLs allow time-limited upload/download access without exposing storage credentials. See the official references in section 23.

### Target repository structure

```text
apps/
  web/                 # Next.js portal, team app, showcase, REST endpoints
  worker/              # queue consumers and scheduled jobs
packages/
  db/                  # schema, migrations, RLS policies, repositories
  domain/              # state machine, commands, events, validation
  authz/               # permissions and workspace-scope checks
  storage/             # upload, scan, preview, and download adapters
  notifications/       # templates, preferences, provider adapters
  ui/                  # design system and tenant theme primitives
  observability/       # logging, tracing, metrics
  test-support/        # factories, fixtures, tenant isolation helpers
docs/
  adr/                  # architecture decision records
  runbooks/             # operations and incident procedures
```

Use a workspace package manager and one lockfile. Run the web and worker as separate deployable units from the same repository.

## 6. Tenant resolution and access model

### Tenant resolution

1. Resolve the request host to an agency domain record.
2. Resolve the client workspace slug within that agency.
3. Exchange the portal secret for a short-lived, HTTP-only, secure portal session.
4. Put `agency_id`, principal type, workspace scope, and request ID into server-side request context.
5. Re-check permission and resource scope inside every command/query handler.
6. Set the PostgreSQL tenant context transaction-locally before any tenant-owned query.

Middleware may route hosts, but it is not the authorization boundary.

### Client-link security

`portal.rainhopes.work/acme-482` is discoverable and cannot safely be the credential. Use one of these shapes:

- `portal.rainhopes.work/acme-482?t=<high-entropy-secret>`, then remove the query string after session exchange; or
- `portal.rainhopes.work/c/<slug>/<high-entropy-secret>`.

Store only a hash of the access secret. Support rotation, revocation, expiration policy, last-used metadata, rate limiting, and an optional OTP challenge. Apply a strict referrer policy so secrets are not leaked to third-party previews or analytics.

### Authorization rule

Every protected operation must satisfy all applicable checks:

```text
valid principal
AND matching agency
AND workspace membership or portal workspace scope
AND permission granted by role
AND resource assignment/visibility rule
AND current state permits the command
```

Admin override actions require a reason and create an audit event. A designer's ownership filter is enforced by the service/database query, not merely hidden in the UI.

### Tenant database controls

- Add `agency_id` to every tenant-owned row.
- Use composite foreign keys such as `(agency_id, client_id)` to prevent cross-tenant references.
- Enable and force RLS for tenant tables; use a default-deny policy.
- Run the application with a database role that cannot bypass RLS and is not the table owner.
- Give background jobs an explicit agency context. Never run a tenant-wide job without a bounded tenant identifier.
- Test cross-tenant reads and writes automatically for every repository/module.
- Keep object keys under random IDs and validate ownership in the database before issuing signed URLs; path prefixes alone are not authorization.

Physical per-tenant databases can be introduced for a future enterprise tier, but are not required for the initial SaaS release.

### Seed permission model

Permissions are capability records, not role-name checks in code. Seed the following presets and let an Admin customize non-protected roles in the operational release.

| Capability | Admin | PM | Design/Dev | Social | Client portal |
| --- | --- | --- | --- | --- | --- |
| Manage agency, billing, domains | Yes | No | No | No | No |
| Manage roles and team | Yes | No | No | No | No |
| Create/archive client workspace | Yes | Yes, except destructive delete | No | No | No |
| Assign team/work | Yes | Yes | No | No | No |
| View agency analytics | Yes | Yes | Only if granted | Approved queue only | No |
| Create work item/version | Yes | Yes | Assigned workspace/items | No | No |
| View client feedback | Yes | Yes | Owned/assigned items | No | Own workspace history |
| Approve/change/reject | Override with reason | Reopen/close with reason | No | No | Current visible version |
| Download assets | All permitted assets | Scoped workspace | Owned/assigned items | Approved final assets | Approved assets only |
| Manage showcase consent/entries | Yes | Yes | No | View approved feed | No; consent is captured separately |
| Mark social/print handoff | Yes | Yes | No | Yes | No |
| View audit log | All | Scoped operational history | Item history only | Handoff history only | Client-safe timeline only |

Protect platform-level permissions, billing, tenant deletion, break-glass access, and the final active Admin from unsafe customization. Permission changes take effect server-side immediately and are themselves audited.

## 7. Workflow and state model

Separate work-item lifecycle from client review decisions.

### Work-item lifecycle

```text
DRAFT
  -> AWAITING_CLIENT_REVIEW       publish current version
  -> ARCHIVED                     PM closes draft

AWAITING_CLIENT_REVIEW
  -> APPROVED                     client approves current version
  -> REVISION_REQUIRED            client requests changes or rejects
  -> ARCHIVED                     PM closes with reason

REVISION_REQUIRED
  -> AWAITING_CLIENT_REVIEW       team publishes next version
  -> ARCHIVED                     PM closes with reason

APPROVED
  -> REVISION_REQUIRED            PM/Admin reopens with reason
  -> ARCHIVED                     retention/closure policy
```

The decision record is `APPROVE`, `REQUEST_CHANGES`, or `REJECT`. This permits separate rejected and changes-requested analytics even though both continue through the revision workflow.

### State invariants

- A review always targets one immutable `work_item_version_id`.
- Only the current published version accepts a decision.
- Request Changes and Reject require at least one feedback input: text, voice note, reference file, or valid reference URL.
- An approval cannot be silently overwritten. Reopen is a separate privileged command.
- Version numbers increment atomically and are unique within a work item.
- Assets attached to a published version are immutable; a replacement creates another version.
- Duplicate commands use idempotency keys and do not create duplicate decisions, versions, notifications, or audit events.
- Lifecycle changes, domain events, notification-outbox records, and audit records commit in one database transaction.

## 8. Data model

Use UUIDv7/ULID-style non-sequential public identifiers. Never expose an incrementing database ID as authorization material.

### Tenancy and identity

- `agencies`: tenant, status, locale, timezone, branding settings.
- `agency_domains`: subdomain/custom domain, verification and certificate status.
- `users`: internal user identity-provider link and profile.
- `client_contacts`: optional named client-side reviewers.
- `roles`, `permissions`, `role_permissions`: tenant-configurable RBAC.
- `agency_memberships`: user-to-agency role membership.
- `workspace_memberships`: internal user/client-contact scope for a client workspace.
- `portal_access_tokens`: hashed secret, workspace, expiry policy, revoked/last-used fields.
- `portal_sessions`: short-lived session, principal, workspace, assurance level.

### Work and review

- `client_workspaces`: client profile, slug, status, consent, SLA policy, branding override.
- `divisions`: agency-defined categories such as Web, Branding, Social, App, and Video.
- `work_items`: title, division, owner, lifecycle state, current version, dates.
- `work_item_versions`: version number, publish state, submitted-by, published-at.
- `assets`: storage key, original name, detected MIME, byte size, checksum, scan state, preview state.
- `version_assets`: asset purpose and ordering for each version.
- `review_decisions`: decision, reviewer, version, text summary, timestamps.
- `feedback_entries`: text, voice, reference URL/file, original language, visibility.
- `item_assignments`: assignee/team history.
- `item_events`: client-safe operational timeline events.
- `internal_comments`: explicitly separate and never returned to portal principals.

### Publishing, automation, and operations

- `showcase_entries`: approved version, consent snapshot, ordering, public metadata.
- `publishing_handoffs`: ready/posted/printed state, actor, channel, timestamp.
- `notification_preferences`, `notifications`, `notification_deliveries`.
- `outbox_events`: reliable post-commit event dispatch.
- `sla_policies`, `reminder_instances`.
- `transcripts`, `translations`: provider output; always retain the original content.
- `audit_events`: append-only actor/action/resource/before-after metadata and correlation ID.
- `subscriptions`, `entitlements`, `usage_counters`: SaaS phase only.
- `export_jobs`, `deletion_requests`: privacy operations.

Important constraints and indexes:

- Unique `(agency_id, workspace_slug)` and `(agency_id, custom_domain)`.
- Unique `(agency_id, work_item_id, version_number)`.
- One current version per work item.
- Decision uniqueness/idempotency for a reviewer, version, and request key.
- Index all list/filter paths by `agency_id`, workspace, lifecycle state, division, owner, and timestamps.
- Use a database trigger or restricted database role to reject updates/deletes on audit rows. For stronger tamper evidence, chain event hashes and periodically anchor the chain outside the primary database.

## 9. API and event boundaries

Expose `/api/v1` REST resources. The UI may call server actions for simple forms, but all domain mutations must pass through the same command layer as REST endpoints.

Core endpoint groups:

- `/auth/*`, `/portal/access/exchange`, `/portal/otp/*`.
- `/clients`, `/clients/{id}/memberships`, `/clients/{id}/dashboard`.
- `/work-items`, `/work-items/{id}`, `/work-items/{id}/assignments`.
- `/work-items/{id}/versions`, `/versions/{id}/publish`.
- `/versions/{id}/reviews`.
- `/uploads/presign`, `/uploads/{id}/complete`, `/assets/{id}/download`.
- `/notifications`, `/notifications/{id}/read`.
- `/showcase/*`, `/publishing-handoffs/*`.
- `/roles`, `/permissions`, `/audit-events`.
- `/webhooks/billing`, `/webhooks/email`, and later integration-specific webhooks.

All mutations accept an idempotency key. Use consistent error envelopes with a safe public message, stable error code, request ID, and field errors where relevant.

Initial domain event catalog:

- `workspace.created`
- `work_item.created`
- `work_item.assigned`
- `version.upload_completed`
- `version.published`
- `review.approved`
- `review.changes_requested`
- `review.rejected`
- `work_item.reopened`
- `work_item.archived`
- `showcase.published`
- `handoff.ready`
- `handoff.completed`
- `sla.breached`

Consumers must be retryable and idempotent. Failed jobs go to a dead-letter queue with an operations alert and replay tooling.

## 10. File, voice, and preview pipeline

1. Server validates requested file name, declared type, size, workspace, and quota.
2. Server creates an asset row in `PENDING_UPLOAD` and returns a scoped presigned upload.
3. Browser uploads directly to a quarantine bucket/prefix using a checksum.
4. Completion command verifies object size/checksum and enqueues malware/type inspection.
5. Worker detects the real file type from bytes, scans it, extracts safe metadata, and generates preview derivatives.
6. Only `READY` assets can be attached to a published version or downloaded.
7. Downloads use short-lived, content-disposition-safe signed URLs after authorization.

Use the browser `MediaRecorder` API for voice notes, with a normal audio-file upload fallback for unsupported MIME/device combinations. Normalize audio asynchronously for playback and later transcription. Test current Safari iOS and Chrome Android behavior before the client pilot.

External embeds must use an allowlist. Render unknown links as safe outbound links, not arbitrary iframes. Sanitize filenames, captions, URLs, and SVG; do not render uploaded active HTML.

Phase 0 must set per-plan file limits and supported formats. A reasonable MVP starting point is images/PDF up to 50 MB each, audio up to 100 MB, and video up to 500 MB with multipart upload; larger production-video workflows can use external links until quotas and transcoding are validated.

## 11. Instagram-inspired experience and installable PWA

The product should feel immediately familiar to an Instagram user: media is primary, navigation is simple, actions are reachable with one thumb, and complexity appears only when requested. It must remain an original ClientLoop design suitable for white-label resale. Do not copy Instagram trademarks, logo, proprietary icons, branded gradient, exact screens, or private assets.

### Visual language

- Use a clean neutral canvas, high-contrast text, hairline borders, restrained shadows, and rounded media/cards.
- Give each work item a feed-style header, large media preview, concise metadata, status indicator, and clearly separated action area.
- Keep Approve, Changes, and Reject visible in a sticky mobile action bar. Make the safe primary action prominent without visually hiding the alternatives.
- Use circular avatars for client/team identity, compact status chips, lightweight dividers, and familiar icon-plus-label navigation.
- Use motion sparingly for state confirmation, drawers, uploads, and version changes. Respect `prefers-reduced-motion`.
- Use ClientLoop or tenant brand colors as accents. Approval, warning, rejection, and focus colors remain semantic and meet contrast requirements even when a tenant chooses a poor brand color.
- Provide light mode in the MVP and design tokens for a later dark mode. Installed-app status/navigation chrome must match the active theme.

### Responsive layout behavior

Mobile is the source layout, not a compressed desktop page.

| Viewport | Layout behavior |
| --- | --- |
| 320–479 px | Single media-first column, compact top bar, fixed bottom navigation, safe-area-aware sticky review actions, full-width sheets. |
| 480–767 px | Single centered column with increased gutters and larger preview controls. |
| 768–1023 px | Navigation rail or compact sidebar, centered feed/detail column, optional slide-over context panel. |
| 1024–1439 px | Persistent left navigation, 640–720 px review column, right-side feedback/activity panel where useful. |
| 1440 px and above | Bounded three-region layout; content does not stretch indefinitely and reading/media widths remain intentional. |

Implementation rules:

- Support 320 px width without horizontal scrolling and landscape mobile without hiding decisions.
- Use CSS grid/flex, logical properties, fluid spacing/type tokens, and container queries for reusable cards/panels.
- Use `env(safe-area-inset-*)` for installed iOS/Android experiences and bottom actions.
- Make touch targets at least 44 by 44 CSS pixels with visible keyboard focus and non-color status cues.
- On desktop, use available space for navigation and contextual history; do not enlarge the main media/feed column until it becomes hard to scan.
- Use responsive images, generated thumbnails/posters, lazy loading, skeleton states, and list virtualization where feeds can become long.

### Typography policy

Instagram's current brand type family is Instagram Sans, but it is a proprietary Meta/Instagram identity asset and no public commercial web-font license should be assumed. Do not download it from unofficial mirrors, copy it from Instagram's application/CDN, or bundle it in this resellable SaaS without written rights.

Production font stack:

```css
font-family: "Inter", "Noto Sans Malayalam", "Noto Sans Devanagari",
  "Noto Sans Tamil", "Noto Sans Kannada", system-ui, -apple-system,
  "Segoe UI", Roboto, Arial, sans-serif;
```

- Self-host licensed WOFF2 variable/subset files to avoid third-party font calls from private portal pages.
- Use Inter Variable 400 for body text, 500/600 for controls and metadata emphasis, and 650–750 for headings.
- Add Noto script subsets based on supported languages and verify baseline, line height, truncation, and input composition with real Malayalam and other Indian-language content.
- Use fluid but bounded type sizes: 14–16 px body, 12–14 px metadata, 20–28 px page titles, and 28–40 px marketing/showcase display text.
- If Rainhopes provides a valid Instagram Sans license, implement it through a typography design token so no component code changes; retain system/Noto fallbacks for unsupported glyphs.

Inter is distributed under the SIL Open Font License and can be embedded in a commercial software product subject to its license terms. Preserve the font license notice in the distribution/repository.

### Installable PWA

Build PWA support during the internal MVP, not as a post-SaaS enhancement.

- Serve all installable surfaces over HTTPS.
- Generate a valid manifest per agency host with `name`, `short_name`, `start_url`, `scope`, `display: standalone`, `theme_color`, `background_color`, description, categories, and orientation behavior.
- Provide 192 px and 512 px icons plus maskable icons, Apple touch icon, favicon set, screenshots, and monochrome icon where supported.
- For white-label tenants, generate or validate tenant-specific app name, colors, and icons. Fall back safely to ClientLoop assets when an uploaded icon is invalid.
- Never include a portal secret or signed download URL in `start_url`, shortcuts, manifest, analytics, or cached navigation history.
- Use a service worker to cache only versioned application-shell assets and a generic offline page. Use network-first/no-store behavior for authenticated HTML/API responses.
- Explicitly exclude client media, voice notes, feedback payloads, signed URLs, token-bearing routes, and audit data from runtime caches.
- Do not support offline approvals, uploads, or edits in MVP. Show a clear offline state and retry when connectivity returns so an action is never presented as saved when it is not committed.
- Add an in-app Install ClientLoop action only after useful engagement. Use `beforeinstallprompt` where supported and platform-specific Add to Home Screen guidance for iOS.
- Detect standalone mode, preserve deep-link routing after launch, and return users to the correct authenticated workspace where the session remains valid.
- Show a non-blocking New version available action when the service worker changes. Do not leave users on an old application shell during an approval action.
- Keep Web Push optional and deferred to the notification/integration phase; installability must not require notification permission.

Installability is progressive enhancement: unsupported browsers continue to receive the complete responsive website.

### Experience performance budgets

- Target Largest Contentful Paint at or below 2.5 seconds on a representative mid-range mobile device and normal 4G for the portal feed's first screen, excluding an intentionally opened full-resolution asset.
- Keep initial route JavaScript within an agreed bundle budget and lazy-load recorders, PDF viewers, video players, analytics charts, and Admin-only modules.
- Reserve media dimensions to prevent layout shift and show poster/thumbnail derivatives before originals.
- Do not load a feed's full-resolution assets until requested.
- Measure real-user performance by device class and tenant without recording portal secrets or feedback content.

## 12. Screen implementation sequence

Build reusable list, filter, asset-preview, timeline, status, feedback, and permission components rather than 21 separate page implementations.

### MVP screens

1. Internal sign-in and account security.
2. PM client roster.
3. Create/edit client workspace and rotate portal link.
4. Team assigned-items queue.
5. Work-item create/upload/revise.
6. Internal item detail/history.
7. Client review feed.
8. Client item detail with review and feedback controls.
9. Client downloads.
10. Basic client dashboard.
11. Basic agency dashboard.
12. In-app notification center.
13. Minimal team/member assignment administration.

### Operational screens

14. SLA/stalled-items queue.
15. Roles and permissions editor.
16. Ready-to-publish queue and asset download.
17. Client showcase editor/public page.
18. Agency showcase editor/public page.
19. Advanced agency/client analytics.
20. Searchable audit log.
21. Branding/domain settings shell.

### SaaS screens

22. Billing/subscription and usage.
23. Self-serve agency onboarding and domain verification.

Some supplied entries become tabs or modes within one route, so URL-level screen count may differ from the product inventory.

## 13. Phased delivery plan

Estimates assume two full-stack engineers, one backend/platform engineer, a half-time product designer who is full-time during design-system and client-review work, half-time QA, and part-time product/DevOps support. They are ranges, not commitments; validate them after Phase 0 refinement.

### Phase 0 — Product decisions and engineering foundation (1–2 weeks)

Work:

- Confirm the decisions in section 3, supported formats/limits, notification provider, and pilot clients.
- Define measurable event semantics for counts, approval time, turnaround time, and revision cycles.
- Produce wireflows for the review loop on mobile and the internal upload/revision loop.
- Produce a high-fidelity Instagram-inspired mobile concept and its tablet/desktop adaptations using original ClientLoop visual assets.
- Define responsive breakpoints, navigation transformations, design tokens, component states, touch behavior, and performance budgets.
- Complete the Instagram Sans licensing decision; otherwise approve Inter Variable plus Noto as the production type system.
- Define per-tenant PWA naming, icon, start URL, scope, install, update, and safe-cache behavior.
- Initialize Git, branch protections, code ownership, issue templates, and decision records.
- Convert the Vite starter to the target workspace and Next.js/TypeScript application.
- Establish local Docker services or documented managed development equivalents.
- Add linting, formatting, type checks, unit tests, integration tests, and build checks.
- Create development, staging, and production environments with separate data stores and secrets.
- Decide identity, email, hosting, object storage, queue, and error-monitoring providers through short ADRs.
- Complete an abuse/threat-model workshop focused on leaked portal links, tenant escape, malicious files, and custom-domain takeover.

Exit criteria:

- Approved workflow wireflow, permission matrix, state diagram, analytics definitions, and responsive design system.
- Client review prototypes pass mobile usability review at 320 px and receive explicit desktop layout approval.
- Typography licensing and PWA behavior are recorded in ADRs.
- CI runs on a clean checkout and deploys a health-checked staging skeleton.
- Initial architecture/security ADRs accepted.
- Pilot owners and support path identified.

### Phase 1 — Secure vertical slice (2–3 weeks)

Work:

- Implement agencies, users, memberships, client workspaces, divisions, and seeded roles.
- Add internal authentication and MFA policy hooks.
- Implement host/workspace resolution, hashed portal tokens, session exchange, rotation, and revocation.
- Add initial RLS policies and automated two-tenant isolation tests.
- Create one work item, upload and scan one image/PDF, publish v1, review it from the portal, and display the resulting audit timeline.
- Implement transactional outbox and a worker that sends a test email notification.
- Implement the design tokens, responsive application shell, mobile bottom navigation, and desktop navigation rail used by the vertical slice.
- Add a staging manifest, icons, standalone launch, offline fallback, and private-data cache exclusions.

Exit criteria:

- A staging user can execute the complete v1 upload-to-decision flow.
- Cross-tenant and out-of-workspace test attempts fail at both service and database layers.
- Every mutation appears once in the audit log and duplicate requests are idempotent.
- No file is public in object storage.
- The same vertical slice is usable at 320 px, tablet, and desktop widths and can be installed from a supported staging browser.

### Phase 2 — Rainhopes internal MVP (4–6 weeks)

Work:

- Complete work-item queues, assignment, divisions, filters, and ownership rules.
- Add multi-file versions, atomic auto-versioning, drafts, publish, revision, reopen, and archive commands.
- Add image/PDF/video/audio previews and robust upload progress/retry.
- Add text, voice, reference file, and reference URL feedback.
- Complete the Instagram-inspired portal feed/detail, approved downloads, thumb-reachable sticky actions, and responsive desktop detail layout.
- Complete reusable responsive feed cards, media viewers, drawers/sheets, bottom navigation, desktop rails, status chips, and timeline components.
- Self-host the licensed Inter/Noto font assets with optimized subsets, fallback metrics, and no layout-blocking third-party font request.
- Complete tenant-aware PWA manifests/icons, safe service-worker caching, offline status, install education, standalone deep links, and update prompts.
- Add in-app/email notification preferences and delivery tracking.
- Add basic counts for client and agency dashboards.
- Add searchable internal item history and basic audit viewer for Admin.
- Add accessibility, browser, responsive, failure-state, and localization-readiness work.
- Add support runbooks, backups, restore drill, monitoring alerts, and feature flags.

Exit criteria:

- All MVP acceptance tests in section 14 pass.
- Admin, PM, designer/developer, and client pilot journeys pass role-based UAT.
- Mobile, tablet, desktop, and installed-app journeys pass design and usability QA.
- Two pilot clients complete real review cycles without WhatsApp file exchange.
- Backup restore, portal-token revocation, failed-job replay, and incident rollback are demonstrated in staging.
- No open critical/high security defect; no unresolved tenant-isolation defect at any severity.

### Phase 3 — Pilot hardening and internal rollout (2–3 weeks)

Work:

- Pilot with 2 clients, then 10, then all appropriate Rainhopes clients.
- Instrument opens, publish-to-decision time, revision cycles, completion, delivery failures, and portal errors.
- Improve onboarding, empty states, notification copy, upload reliability, and mobile ergonomics from observed sessions.
- Measure install conversion, standalone launches, update failures, layout performance, and device-specific review abandonment.
- Add a lightweight historical-final-work import flow if the pilot demonstrates demand.
- Establish data-quality checks and a weekly product/operations review.

Exit criteria:

- At least 80% of pilot review cycles use ClientLoop end-to-end for four consecutive weeks.
- Notification failure and upload failure rates are within agreed service thresholds.
- Support ownership, escalation, and recovery procedures work in practice.
- Product signs off on Phase 3 analytics definitions using production-like data.

### Phase 4 — Operational depth (5–7 weeks)

Work:

- Add complete version history/timeline UX and advanced client/agency analytics.
- Add weekly/monthly/yearly/custom filters and division/client filters.
- Add SLA policies, stalled-side calculation, reminder scheduler, and nudge actions.
- Add roles/permissions editor with safe presets and lockout prevention.
- Add client and agency showcase, consent snapshots, indexing controls, and share previews.
- Add Ready to Publish queue, approved asset handoff, Posted/Sent to Print actions, and timeline events.
- Add audit search/export with sensitive-field redaction.
- Complete branding configuration needed by Rainhopes even before paid custom domains.

Exit criteria:

- Analytics reconcile against raw events in an automated fixture dataset.
- Permission changes cannot remove the final active agency Admin.
- Public showcases expose approved, consented versions only.
- SLA jobs are time-zone correct, idempotent, and suppressible.

### Phase 5 — Automation layer (4–6 weeks)

Work:

- Introduce transcription and translation provider adapters with tenant feature flags and usage budgets.
- Preserve original feedback; label machine-generated text, provider, model, language, and timestamp.
- Add retries, manual reprocess, failure display, and deletion propagation for AI artifacts.
- Add weekly/monthly digest generation with preview and unsubscribe controls.
- Add unopened-link and idle-item reminder policies.
- Add auto social handoff and optional Slack/WhatsApp connectors.
- Complete privacy impact review and provider data-processing configuration.

Exit criteria:

- Automation is asynchronous and never blocks approval/review.
- Original language/audio remains available and machine output is visibly identified.
- Per-tenant budgets, feature flags, consent, deletion, and failure handling are verified.
- Integration webhooks are signed, replay-safe, rate-limited, and observable.

### Phase 6 — SaaS productization (7–10 weeks)

Work:

- Add agency sign-up, verification, onboarding, initial Admin creation, and sample workspace.
- Add subscription checkout, customer portal, webhook-based subscription state, entitlements, usage limits, grace periods, and dunning UX.
- Add subdomain provisioning, custom-domain verification, certificate lifecycle, ownership re-check, and domain removal.
- Add agency branding, email branding, and removal of Rainhopes identity where the plan permits.
- Add quotas for active clients, seats, storage, AI minutes/characters, and integrations.
- Add agency export, closure, deletion workflow, retention windows, and restore restrictions.
- Add SaaS support/admin tooling without unrestricted tenant impersonation; audited break-glass access only.
- Run penetration testing, load testing, disaster-recovery exercise, privacy/legal review, and billing reconciliation.

Exit criteria:

- A new agency can subscribe, onboard, invite a teammate, create a client, and complete a review without Rainhopes intervention.
- Billing webhooks are idempotent and the local entitlement state reconciles with the billing provider.
- Domain takeover protections and offboarding are tested.
- Security, privacy, backup/restore, support, and incident-response launch gates are signed off.

Expected total: 26–38 weeks with the assumed team. The polished, installable internal MVP can reach a controlled pilot in approximately 10–15 weeks. Resourcing, design readiness, font/brand approvals, PWA/device QA, file-processing complexity, and identity/domain provider choices are the largest schedule variables.

## 14. MVP acceptance criteria

### Client access and isolation

- A valid portal link opens only its bound workspace; changing a slug, host, object ID, or API parameter cannot expose another workspace or agency.
- Revoking/rotating a link ends new access immediately and existing portal sessions within the configured maximum session age.
- Optional OTP can be enabled per workspace without changing the portal URL.
- Client responses never include internal comments, internal identities hidden by policy, storage keys, or unrelated tenant IDs.

### Upload and versioning

- An authorized team member can create, upload, save a draft, and publish a work item.
- A published version and its asset set cannot be edited in place.
- A revision increments the version exactly once under concurrent/retried requests.
- Unsupported, oversized, corrupt, or infected files never become reviewable.
- Interrupted direct uploads can retry safely and abandoned uploads are cleaned up.

### Review loop

- The client can approve with one action and can add optional feedback.
- Request Changes and Reject require text, voice, reference file, or reference URL.
- A decision is bound to the visible version; a stale tab cannot decide a superseded version.
- Changes/Reject moves the item to `REVISION_REQUIRED`; publishing the next version returns it to `AWAITING_CLIENT_REVIEW`.
- Every version, decision, feedback entry, actor label, and timestamp appears in the permitted timeline.
- English, Manglish, Malayalam, and other Unicode text round-trip without corruption.

### Notification and dashboard

- Publishing a version notifies client recipients; a client decision notifies the owner/PM.
- Notification creation is durable even when the email provider is unavailable, with retry and failure visibility.
- Client counts and agency counts match the defined latest-state rules and exclude archived/test data as specified.
- Approved downloads require a fresh authorization check and expire automatically.

### Design, responsiveness, and PWA

- The client experience is recognizably media-first and Instagram-inspired while using original ClientLoop branding, icons, copy, and interaction details.
- Every primary client and team workflow works without horizontal scrolling at 320, 375, 768, 1024, and 1440 px reference widths.
- Review actions remain visible/reachable without covering essential content, including device safe areas, landscape mobile, enlarged text, and the on-screen keyboard.
- Mobile uses bottom navigation and sheets where appropriate; desktop uses persistent navigation and contextual side panels without stretching the review column excessively.
- Text remains legible and controls usable at 200% browser zoom. Touch targets, keyboard focus, contrast, reduced motion, and screen-reader labels meet the agreed accessibility standard.
- The production bundle uses only font files with recorded commercial embedding rights. Instagram Sans is absent unless its written license is stored and approved.
- Each agency host serves a valid branded manifest with install icons, standalone display, safe start URL, theme/background colors, and correct scope.
- Installation and standalone launch are verified on supported Android/Chromium, iOS Add to Home Screen, and desktop Chromium paths; unsupported browsers retain the full website.
- Going offline displays an honest offline state. Approval, upload, and feedback actions are not reported as complete until the server commits them.
- Service-worker/cache inspection proves that portal tokens, private media, signed URLs, feedback, and authenticated API responses are not stored in runtime caches.
- An installed client can follow a deep link, resume a valid portal session, and receive a controlled application-shell update without losing an in-progress feedback draft.
- The first portal screen meets the agreed mobile performance budget using representative media and a throttled test profile.

### Quality and operations

- Keyboard and screen-reader paths cover primary review actions; color is not the only status signal.
- Critical journeys pass on supported desktop browsers, current Chrome Android, and current Safari iOS.
- Audit events are append-only through application and database permissions.
- Automated tests prove tenant isolation, resource scoping, permission enforcement, state transitions, and idempotency.
- Production has health checks, alerts, backups, restore procedure, safe migrations, and rollback/run-forward procedures.

## 15. Testing strategy

- Unit tests: state machine, permission evaluation, SLA calculations, entitlement rules, validation, and template rendering.
- Database integration tests: constraints, migrations, repositories, RLS default-deny, and cross-tenant attempts using the real PostgreSQL engine.
- Contract tests: storage, identity, email, billing, translation, transcription, and integration adapters.
- API tests: authentication, authorization, idempotency, concurrency, pagination, filters, and safe errors.
- End-to-end tests: one critical journey per role plus portal link rotation, stale-version decision, revision loop, download, and audit verification.
- Browser/device tests: voice capture/playback, file picker/camera upload, sticky action controls, and slow/interrupted mobile connections.
- Responsive visual-regression tests: mobile, tablet, desktop, wide desktop, light theme, long translations, enlarged text, and tenant-brand extremes.
- PWA tests: manifest per host, icon/maskable rendering, installability, standalone routing, safe cache allow/deny rules, offline state, update flow, and service-worker rollback.
- Security tests: OWASP ASVS-oriented review, dependency/secret scanning, malicious upload cases, IDOR/tenant escape, CSRF, XSS, SSRF through previews, rate limits, and custom-domain takeover.
- Performance tests: portal feed, dashboard queries, concurrent review actions, large/multipart uploads, notification bursts, and worker backlog recovery.
- Accessibility tests: automated checks plus manual keyboard and screen-reader verification for primary workflows.

Use deterministic clocks and factories for lifecycle/analytics tests. Do not rely only on mocked database tests for tenant isolation.

## 16. Delivery, deployment, and operations

### CI/CD gates

- Install from lockfile, lint, format check, type check, unit/integration tests, production build.
- Migration lint and test against both an empty database and a copy of the previous schema.
- Dependency, secret, and static security scans.
- Automated responsive screenshots, accessibility checks, manifest validation, service-worker cache-policy tests, and agreed bundle/performance budgets.
- Preview environment per pull request with synthetic tenant data only.
- Manual production approval until the post-pilot incident rate is stable.

### Environment and data controls

- Separate cloud accounts/projects, databases, buckets, queues, domains, keys, and provider credentials for development, staging, and production.
- Infrastructure as code for repeatability.
- Secrets manager; never place secrets in repository or client bundles.
- Encrypt at rest and in transit. Use provider-managed keys initially and document the path to tenant/customer-managed keys if later required.
- Point-in-time database recovery, object versioning where appropriate, lifecycle cleanup, and quarterly restore tests.
- Apply backward-compatible expand/migrate/contract database changes; never combine irreversible data destruction with an unverified deploy.

### Initial service objectives

- 99.9% monthly availability target for the paid SaaS tier after launch.
- 95th percentile review-command response below 1 second, excluding file transfer and third-party delivery.
- 99% of notification jobs enqueued within 30 seconds of the committed event.
- Zero accepted cross-tenant data exposure; treat any occurrence as a critical incident.
- Recovery point objective of 15 minutes and recovery time objective of 4 hours for the first paid release, subject to provider validation.

## 17. Analytics definitions

Agree on definitions before dashboard development:

- Work items shared: distinct work items with a first `version.published` event in the selected period.
- Current approved/changes/rejected count: work items whose current version has that latest client decision; rejected can coexist with lifecycle `REVISION_REQUIRED`.
- Revision cycles: count of published versions after v1, or alternatively count of non-approve decisions. Pick one primary metric and label the other separately.
- Client decision time: first published-at to the first decision on that version.
- Final approval turnaround: first version published-at to approval of the ultimately approved version, excluding or including paused time according to an explicit rule.
- Open rate: first portal view attributable to a version notification, with bot/email-prefetch filtering where possible.
- SLA age: time since responsibility last moved to the current party, not simply time since item creation.
- PWA adoption: eligible install prompt shown, install action accepted where observable, first standalone launch, repeat standalone launch, and uninstall proxy signals. Do not treat browser support gaps as user rejection.

Build analytics from immutable domain events or audited timestamps. Maintain queryable projections for dashboard speed; do not mutate source history to repair charts.

## 18. Prioritized epic backlog

| Epic | Outcome | Phase | Depends on |
| --- | --- | --- | --- |
| CL-PLAT | Repository, environments, CI/CD, observability | 0 | None |
| CL-DESIGN | Instagram-inspired design tokens, responsive shell, feed/detail components, accessibility | 0–2 | CL-PLAT |
| CL-PWA | Tenant manifests, icons, install UX, safe service worker, offline/update states | 1–2 | CL-PLAT, CL-DESIGN |
| CL-TEN | Agency/workspace tenancy, host resolution, branding base | 1 | CL-PLAT |
| CL-IAM | Internal auth, portal access, memberships, RBAC | 1–2 | CL-TEN |
| CL-DATA | PostgreSQL schema, RLS, migrations, audit/outbox | 1 | CL-PLAT |
| CL-MEDIA | Direct upload, scan, previews, signed downloads, voice | 1–2 | CL-DATA |
| CL-WORK | Items, assignments, versions, lifecycle state machine | 1–2 | CL-IAM, CL-DATA |
| CL-REVIEW | Portal feed/detail, decisions, feedback, timeline | 1–2 | CL-WORK, CL-MEDIA |
| CL-NOTIFY | In-app/email delivery and preferences | 1–2 | CL-DATA |
| CL-ANALYTICS | Metric events, basic counts, advanced dashboards | 2–4 | CL-WORK, CL-REVIEW |
| CL-SLA | Stalled-side calculation, schedules, nudges | 4 | CL-NOTIFY, CL-ANALYTICS |
| CL-SHOWCASE | Consent-controlled client/agency public portfolio | 4 | CL-MEDIA, CL-WORK |
| CL-HANDOFF | Ready-to-publish/social/print workflow | 4 | CL-WORK, CL-NOTIFY |
| CL-AUTO | Transcription, translation, reminders, digests | 5 | CL-NOTIFY, CL-MEDIA |
| CL-SAAS | Onboarding, billing, entitlements, quotas, domains | 6 | CL-TEN, CL-IAM, CL-PLAT |
| CL-PRIVACY | Export, retention, deletion, consent operations | 2–6 | CL-DATA, CL-MEDIA |

## 19. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Friendly link treated as authentication without entropy | Unauthorized client data access | Opaque high-entropy secret, hashed storage, session exchange, rotation, OTP option, rate limiting. |
| Tenant checks implemented only in UI/application code | Cross-agency exposure | Composite tenant keys, forced RLS, non-owner DB role, isolation test suite. |
| File previews introduce malware/XSS/SSRF | Account or infrastructure compromise | Quarantine, magic-byte detection, malware scan, derivative rendering, embed allowlist, CSP. |
| Client actions race with a new version | Approval applies to wrong work | Version-bound decisions, optimistic concurrency, current-version constraint, idempotency. |
| Email/AI/integration provider outage blocks core loop | Review delays or data loss | Transactional outbox, durable queue, retries/DLQ, core workflow independent of automation. |
| Granular RBAC becomes too complex | Lockouts or privilege escalation | Safe role presets, server authorization tests, final-Admin protection, audited changes. |
| Analytics disagree with operations | Loss of management trust | Definitions before UI, event-derived metrics, reconciliation fixtures, data-quality alerts. |
| Storage/AI usage makes SaaS unprofitable | Poor margins | Quotas, usage counters, plan entitlements, lifecycle rules, cost dashboards. |
| Custom-domain lifecycle enables takeover | Brand/security incident | Verify ownership, automate certificates, periodically re-check DNS, clean removal on churn. |
| Browser voice recording is inconsistent | Client friction | MIME capability detection, upload fallback, mobile browser matrix, normalized derivative. |
| Unlicensed Instagram font or copied brand assets are shipped | Legal exposure and blocked SaaS resale | Use Inter/Noto by default, retain licenses, require written embedding rights for Instagram Sans, use original ClientLoop assets. |
| Instagram-like styling reduces white-label identity | Agencies appear affiliated with or derivative of Instagram | Copy interaction familiarity, not trademarks or exact visual trade dress; express appearance through tenant-safe tokens. |
| Service worker caches portal secrets or client files | Sensitive data remains on shared/lost devices | Explicit cache allowlist, no-store private responses, cache inspection tests, logout cleanup, short portal sessions. |
| Installed PWA runs an outdated shell during approval | Incorrect or failed client action | Versioned service worker, controlled update prompt, compatibility window, server-side state/version validation. |

## 20. Decisions required before Phase 1 closes

Product owner:

- Confirm `ANY_AUTHORIZED_REVIEWER` for MVP and whether named client contacts are displayed.
- Confirm that Reject remains revisionable and whether a PM can permanently close a rejected item.
- Approve file types, size limits, storage retention, and download policy for superseded versions.
- Select the primary email sender/domain and notification copy owner.
- Define showcase consent wording and whether consent is per client, per item, or both. Recommendation: both.
- Approve analytics definitions and the two pilot clients.
- Approve the Instagram-inspired reference screens for mobile and desktop, including how far white-label tenants may alter layout versus colors/logo/type.
- Provide written commercial web/app embedding rights for Instagram Sans or approve Inter Variable plus Noto as the production decision.
- Approve the PWA install name, default icon, theme colors, install-prompt timing, and whether client-facing installs use the agency name or ClientLoop name.

Engineering/business:

- Select hosting, PostgreSQL, Redis, object storage, identity, transactional email, and observability providers.
- Decide India-only or multi-region data residency expectations before signing international agencies.
- Confirm whether Rainhopes requires DPDP/GDPR counsel review before the internal pilot or before SaaS launch.
- Confirm the first paid plan limits so storage and usage counters are designed correctly.

## 21. First implementation sprint

Once Phase 0 decisions are approved, the first sprint should produce this exact thin slice:

1. Initialize Git and the TypeScript workspace; convert the web app to Next.js.
2. Add local/staging PostgreSQL, Redis, private object storage, secrets, and health checks.
3. Create agency, user, membership, client workspace, work item, version, asset, review, audit, and outbox migrations.
4. Enable initial RLS and write two-tenant negative tests before building page features.
5. Implement internal sign-in and one seeded Admin/PM workflow.
6. Implement portal-token issue, exchange, session, rotate, and revoke.
7. Build image/PDF presigned upload through scan-ready asset finalization.
8. Build create item -> publish v1 -> client approve/request changes -> audit timeline.
9. Deliver decision email through the worker and verify idempotent retry.
10. Apply the Instagram-inspired design tokens and responsive mobile/desktop shell to the vertical slice.
11. Add the staging PWA manifest, install icons, safe offline page, cache allowlist, standalone deep-link test, and update flow.
12. Deploy the vertical slice to staging and run security, architecture, responsive-design, and PWA reviews before expanding screens.

## 22. Definition of done

A feature is done only when:

- Product acceptance criteria and error/empty/loading states are implemented.
- Server-side authorization, tenant scope, state validation, and audit behavior are tested.
- The mobile-first layout, supported desktop layouts, accessibility, long/multilingual content, and installed-app behavior are verified.
- Fonts and visual assets have documented embedding/commercial rights; no Instagram proprietary asset is present without approval.
- PWA manifests, deep links, safe-area behavior, offline/update states, and private-data cache exclusions are verified when the feature changes an installable route.
- Metrics/logging exclude secrets and unnecessary personal data.
- Background effects are idempotent and recoverable.
- Schema/API changes are documented and backward-compatible for deployment.
- Operations have alerts/runbook coverage appropriate to the feature.
- User-facing copy and notification behavior are approved.

## 23. Official technical references

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Vercel multi-tenant platform guidance](https://vercel.com/kb/guide/nextjs-multi-tenant-application)
- [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Amazon S3 presigned uploads and downloads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [Stripe subscription lifecycle](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Instagram brand typography reference](https://about.instagram.com/brand/type)
- [Inter typeface and SIL Open Font License](https://github.com/rsms/inter)
- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN: Web app manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
- [MDN: Service worker and offline PWA tutorial](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/CycleTracker/Service_workers)
