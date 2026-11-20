# DCAS Sports Meet – Build Tracker

Stack: React 19 + Vite + TypeScript · Node/Express API · JSON file storage (`server/data/db.json`) / Supabase ready.
Status key: ✅ done · 🟡 partial · ⬜ todo

## Run it
```bash
npm install
npm run build                      # builds the site into /dist
JUDGE_PIN=1234 ADMIN_PIN=5678 npm start   # serves site + API on http://localhost:3001
# Development: terminal 1 `npm run server`, terminal 2 `npm run dev`
```
Defaults if PINs are not set: judge `1111`, admin `9999` — **change before the event.**

## Code map
| Area | Files |
|---|---|
| Config & Local DB | `server/data/db.json`, `server/config.json` |
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
| Predefined Points Configuration | ✅ | Configure points for Athletics (5/3/1) & Games (10/6/2) + per-event points |
| Admin Team / House Name Management | ✅ | Rename, add, or delete tournament teams in the local database |
| Local Database Persistence | ✅ | All admin config, events, and results saved in `server/data/db.json` |
| Private Poster Studio | ✅ | Removed from public nav; gated with Admin PIN; launched via Admin desk |
| Student Registration | ✅ | Dynamic house list, Boys/Girls selector, categorized event picker |
| Live Results & House Standings | ✅ | Auto-calculates points from predefined event scales; category/gender filters |
| Student Points Check | ✅ | Lookup by reg number showing event category, status, and points earned |
| Admin Desk Podium Publishing | ✅ | Publish 1st/2nd/3rd, auto-calculate points, undo publications |
| Registration CSV Export | ✅ | Full export with RegNo, Name, House, Gender, Category, EventName |
| Public Home | 🟡 | Visuals ported; static showcase data |

## Change Log
- **2026-11-19 (Major Update)**:
  - Re-architected system into two primary categories: **Games** and **Athletics**, each partitioned into **Boys** and **Girls**.
  - Upgraded Admin panel with dedicated tabs for Events & Results, Predefined Points, Team Names, and Registrations.
  - Added support for custom predefined points schemes (Athletics defaults: 5/3/1, Games defaults: 10/6/2, plus per-event custom points).
  - Added dynamic Team / House management allowing admins to rename or add teams.
  - Secured Poster Maker behind Admin PIN authentication and removed it from public navigation.
  - Created [CHANGELOG_AND_DATABASE_GUIDE.md](file:///T:/Project/SportsMeet/CHANGELOG_AND_DATABASE_GUIDE.md) detailing all changes and providing recommendations/schemas for free cloud database migration (Supabase, Neon, Turso).
