# DCAS Sports Meet – Build Tracker

Stack: React 19 + Vite + TypeScript · Node/Express API · Supabase runtime storage when configured, with JSON file storage for local development.
Status key: ✅ done · 🟡 partial · ⬜ todo

## Run it
```bash
npm install
npm run build                      # builds the site into /dist
# Development: terminal 1 `npm run server`, terminal 2 `npm run dev`
node --test server/index.test.js   # isolated auth, audit, and SQL migration checks
```

Create an ignored `.env` file before starting the API:
```dotenv
ADMIN_PIN=use-a-unique-secret-of-at-least-8-characters
JUDGE_PIN=use-a-different-unique-secret-of-at-least-8-characters
ADMIN_NAME=George
JUDGE_NAME=Judge
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_secret
STORAGE_BACKEND=supabase
```
The API will not start if either PIN is missing, shorter than eight characters, or identical to the other. With Supabase credentials configured, the API loads database state before listening and persists mutations to Supabase. Production requires Supabase; the service-role key must remain server-only.

Without Supabase credentials, local development uses `server/data/db.json`. Set `STORAGE_BACKEND=json` to explicitly select JSON storage. `npm run db:push` previews the initial data import; `npm run db:push -- --apply` imports it into an empty Supabase project. `npm run db:migrate` continues to generate a sensitive SQL snapshot under the ignored `server/data/exports/` folder.

## Code map
| Area | Files |
|---|---|
| Config & Persistence | `server/index.js`, `server/supabaseStore.js`, `server/data/db.json` |
| API + Business Rules | `server/index.js` |
| Pages | `src/pages/{Home,Register,Results,Points,Judge,Admin,Poster}.tsx` |
| Shared | `src/api.ts`, `src/hooks.ts`, `src/components/{BottomNav,PinGate}.tsx` |
| Styles | `src/index.css` (design tokens), `src/styles/ui.css` (app screens) |
| Documentation & DB Migration | `CHANGELOG_AND_DATABASE_GUIDE.md` |

## Core System Status
| Feature | Status | Notes |
|---|---|---|
| Games & Athletics Categories | ✅ | Split into Games & Athletics; sub-divided into Boys & Girls |
| Admin Event Entry (by category & gender) | ✅ | Enter, edit, and delete events separately for Boys and Girls |
| Predefined Points Configuration | ✅ | Configure points for Athletics (5/3/1) & Games (10/5/2) + per-event points |
| Admin Team / House Name Management | ✅ | Rename, add, or delete tournament teams in the local database |
| Database Persistence | ✅ | Supabase is the configured runtime database; JSON remains available for local development |
| Private Poster Studio | ✅ | Removed from public nav; gated with Admin PIN; launched via Admin desk |
| Participation Rules | ✅ | Up to 3 individual Athletics events plus one relay per student; 3 participants per house per Athletics event (4 for relay); Games registrations form one house roster with no student cap |
| Student Registration | ✅ | House captains and admins can add participants individually or import up to 100 CSV/Excel rows with separately matched photos and server-side batch validation |
| Judge Placings & Admin Publishing | ✅ | Judges submit unique positions for every participant/team; admins review and publish the top three |
| Homepage Content Controls | ✅ | Admin live-day label and schedule are persisted by the selected server database; published event winners display automatically unless featured winners are configured |
| Live Results & House Standings | ✅ | Auto-calculates points from predefined event scales; category/gender filters |
| Student Points Check | ✅ | Lookup by reg number showing event category, status, and points earned |
| Victory Poster Studio | ✅ | Wrapped, bounded title/subtitle and separated podium layout prevent text overlap |
| Admin Desk Podium Publishing | ✅ | Review judge submissions or publish manually; points are calculated automatically and publications can be undone |
| Registration CSV Export | ✅ | Full export with RegNo, Name, House, Gender, Category, EventName |
| Public Home | ✅ | Live house standings and published winners use the Express API database |

## Change Log
- **2026-11-21 (Participation Rules, Judge Placings & Victory Poster)**:
  - Enforced the Athletics limits of three participants per house per event (four for relay) and up to three individual Athletics events plus one relay per student.
  - Kept Games participation unlimited per student while grouping each house’s event registrations into one team roster.
  - Replaced judge score entry with complete, unique position rankings and an explicit submit step; admins can review and publish submitted podiums.
  - Updated Games and relay winner displays and student points lookup to use the house team’s published placement.
  - Reworked the victory poster layout to wrap long text and keep the podium clear of the subtitle.
- **2026-11-20 (Admin Registration & API Validation)**:
  - Added an Admin Desk registration form with participant photo, house/division, and standard-event validation.
  - Secured the registration list and add-registration API with the Admin PIN, including local-only fallback checks.
  - Increased the JSON request limit so participant photos up to the supported size can be submitted.
  - Fixed the admin registration list polling to include its PIN and preserved server validation errors instead of silently retrying locally.
- **2026-11-20 (Sportsitem.txt & Deletion Bug Fix)**:
  - Removed all obsolete items and replaced them with the exact 30 items specified in `Sportsitem.txt` (10 Games + 20 Athletics).
  - Configured predefined points schemes: Athletics (5/3/1) and Games (10/5/2) as defined in `Sportsitem.txt`.
  - Fixed event deletion bug where HTTP method mismatch prevented items from being removed.
  - Implemented real-time event bus (`sportsmeet:refresh`) in `usePoll` for immediate UI reflection of admin actions.
  - Added full dual-layer local database persistence (`server/data/db.json` & `localStorage`).
  - Added PostgreSQL / Supabase SQL generator and `npm run db:migrate` command for cloud hosting migration.
  - Fixed TypeScript compilation issue in `Admin.tsx`.
  - Connected `Home.tsx` to live database standings.
- **2026-11-19 (Major Update)**:
  - Re-architected system into two primary categories: **Games** and **Athletics**, each partitioned into **Boys** and **Girls**.
  - Upgraded Admin panel with dedicated tabs for Events & Results, Predefined Points, Team Names, and Registrations.
  - Added support for custom predefined points schemes (Athletics defaults: 5/3/1, Games defaults: 10/6/2, plus per-event custom points).
  - Added dynamic Team / House management allowing admins to rename or add teams.
  - Secured Poster Maker behind Admin PIN authentication and removed it from public navigation.
  - Created [CHANGELOG_AND_DATABASE_GUIDE.md](file:///T:/Project/SportsMeet/CHANGELOG_AND_DATABASE_GUIDE.md) detailing all changes and providing recommendations/schemas for free cloud database migration (Supabase, Neon, Turso).
