# Sports Meet Project Context

Last updated: 2026-11-22

This document is a technical handoff for developers and future maintenance work. It contains project structure and operating rules, not credentials.

## What the application does

The DCAS Sports Meet application supports public event information and the event operations workflow:

- Public home page, event schedule, live results, house standings, winners, student points lookup, and photo gallery.
- Admin PIN-protected event, points, schedule, result publishing, registration, captain, gallery, and activity-log controls.
- House-captain accounts that register and remove participants for their assigned house.
- Judge PIN-protected event entries and position submissions for admin review.
- A media-team upload page that is intentionally not linked in navigation.
- CSV/Excel bulk registration (up to 100 participants) with separately selected photos matched by register number or filename.

Event definitions and reset defaults are restricted to the 30 items in `Sportsitem.txt`.

## Architecture and data flow

```text
Browser (React/Vite)
  └── same-origin /api/* requests
        └── Express API (Node.js)
              ├── Supabase PostgreSQL in hosted mode
              ├── server/data/db.json in local JSON mode
              └── Cloudinary for gallery and participant image assets
```

- The frontend is React 19, TypeScript, Vite 8, and Tailwind CSS 4.
- `src/api.ts` is the frontend API client. Vite proxies `/api` to `http://localhost:3001` in development.
- `server/index.js` defines the Express API, authentication checks, participation validation, activity logging, media upload flows, and static serving of `dist/` when built.
- `server/supabaseStore.js` maps application state to Supabase tables. `server/data/migration_supabase.sql` defines the schema; `server/push-to-supabase.js` is the initial-data importer.
- Supabase service-role access stays on the server. The browser must never receive Supabase service-role or Cloudinary API secrets.
- Local development can explicitly use `STORAGE_BACKEND=json`. Production requires `STORAGE_BACKEND=supabase`.

## Roles

| Role | Authentication | Main capabilities |
|---|---|---|
| Public visitor | None | Browse published meet data, gallery, and student points |
| Admin | `ADMIN_PIN` | Manage events, registrations, captains, schedules, points, publishing, gallery, and activity |
| Judge | `JUDGE_PIN` | View assigned entries and submit participant/team placings |
| House captain | Username and password | Add or remove registrations only for the captain's house |
| Media team | `MEDIA_UPLOAD_PASSWORD` | Upload event-gallery photos through the hidden media page |

Captain passwords are hashed for Supabase persistence. Media upload sessions are held in API memory and expire; they do not survive an API restart.

## Core rules and workflows

- Each participant can enter up to three individual Athletics events and one relay.
- A house can enter up to three participants per individual Athletics event and four relay runners.
- Games have no per-participant event cap; same-house registrations form one house team roster for an event.
- The server revalidates registration batches and captain house assignment. Invalid batches are rejected before registration changes are applied.
- Judges submit unique positions; admins review submissions and publish event results.
- Registration photos and event-gallery photos are separate. Participant uploads use `dcas-sports-meet/registrations/participants`; gallery uploads use `dcas-sports-meet/gallery`.
- Gallery and participant photo URLs are publicly accessible Cloudinary URLs. Folder separation is organizational, not access control.

## Important hosting constraint

The API keeps a state cache in process memory and uses in-process serialization for registration rules. **Run one active API instance only.** Do not deploy the current backend as a horizontally scaled Vercel Function or unchanged Cloudflare Worker. A serverless/multi-instance backend requires stateless data access and database transactions/locking.

Vercel and Cloudflare Pages can host the Vite frontend. For the current architecture, proxy `/api/*` from those frontends to one persistent Node API host. The detailed configuration and commands are in [DEPLOYMENT_VERCEL_CLOUDFLARE.md](./DEPLOYMENT_VERCEL_CLOUDFLARE.md).

## Source map

| Path | Purpose |
|---|---|
| `src/App.tsx` | Frontend page routing and application shell |
| `src/pages/` | Home, registration, results, points, judge, admin, poster, gallery, and media screens |
| `src/components/` | Shared UI, including PIN and bulk registration components |
| `src/api.ts` | API requests and the local-data fallback behavior |
| `src/localDb.ts` | Client-side defaults, event definitions, and local data helpers |
| `src/hooks.ts` | Polling and UI refresh behavior |
| `server/index.js` | Express routes, auth, validation, audit, persistence calls, and Cloudinary operations |
| `server/supabaseStore.js` | Supabase state load/persist mapping |
| `server/data/migration_supabase.sql` | Supabase schema and access policy setup |
| `server/data/db.json` | Local JSON data and initial-import source; treat as potentially sensitive |
| `Sportsitem.txt` | Canonical list of sports-meet items |
| `.figma/make/site.json` | Figma Make site metadata imported by `vite.config.ts` |
| `vite.config.ts` | Vite, Tailwind, Figma Make plugins, dev API proxy, and HTML metadata |
| `.env.example` | Safe names/placeholders for local and hosted configuration |

Keep `.figma/` while this project is managed or previewed with Figma Make. The Vite configuration imports its site metadata, and the folder also contains Figma Make tooling.

## Configuration names

The API may use these environment-variable names; actual values belong only in local ignored `.env` files or host secret settings:

- Authentication/identity: `ADMIN_PIN`, `JUDGE_PIN`, `ADMIN_NAME`, `JUDGE_NAME`
- Storage: `STORAGE_BACKEND`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Images/media: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `MEDIA_UPLOAD_PASSWORD`
- Runtime/tooling: `NODE_ENV`, `PORT`, `SPORTSMEET_DB_FILE`, `FIGMA_PUBLIC_URL`, `FIGMA_DEV_SERVER_HOST`

Never paste secret values into project documentation or frontend variables. Rotate any credentials that have been exposed in chat, logs, or source control before deployment.

## Useful commands

```sh
pnpm install
pnpm run dev
pnpm run server
pnpm run build
node --test server/index.test.js
pnpm run db:migrate
pnpm run db:push
```

`db:push -- --apply` is for importing into a new empty Supabase project only; do not run it as a routine deployment command or against a populated project. SQL and JSON exports can contain sensitive data.

## Related documentation

- [Project setup and quick start](./README.md)
- [Vercel and Cloudflare deployment](./DEPLOYMENT_VERCEL_CLOUDFLARE.md)
- [Supabase database and hosting](./SUPABASE_DATABASE_AND_HOSTING_GUIDE.md)
- [Cloudinary setup and operations](./CLOUDINARY_INTEGRATION_GUIDE.md)
- [Development notes and feature status](./DEVELOPMENT.md)
