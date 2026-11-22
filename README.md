# DCAS Sports Meet

The DCAS Sports Meet website provides event schedules, live results, house standings, winners, student points, and an event photo gallery. Admins and house captains can manage registrations; judges submit event placings for admin review.

## Technology

- React 19, TypeScript, Vite 8, and Tailwind CSS 4
- Node.js 22 and an Express API
- Supabase PostgreSQL for hosted persistence; JSON storage for local development
- Cloudinary for participant and gallery images

## Local setup

1. Install Node.js 22 and pnpm 10 (versions are listed in `.mise.toml`).
2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Create a local environment file and replace the example PINs:

   ```sh
   cp .env.example .env
   ```

   PowerShell equivalent:

   ```powershell
   Copy-Item .env.example .env
   ```

   The example selects `STORAGE_BACKEND=json` for local work. The API requires distinct admin and judge PINs of at least eight characters. Keep `.env` private.

4. Start the API and frontend in separate terminals:

   ```sh
   pnpm run server
   pnpm run dev
   ```

   The API defaults to `http://localhost:3001`; Vite defaults to `http://localhost:8443` and proxies `/api` requests to the API.

## Build and tests

```sh
pnpm run build
node --test server/index.test.js
```

The Express server serves the production frontend from `dist/` when that directory exists.

## Supabase and Cloudinary

For hosted use, set `NODE_ENV=production`, `STORAGE_BACKEND=supabase`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` on the API host. Keep service-role and Cloudinary secrets on the server; never expose them through `VITE_` variables. Configure distinct strong `ADMIN_PIN` and `JUDGE_PIN` values. Cloudinary settings enable gallery and participant-photo uploads.

Read the [Supabase database and hosting guide](./SUPABASE_DATABASE_AND_HOSTING_GUIDE.md) before creating or importing a database. See the [Cloudinary integration guide](./CLOUDINARY_INTEGRATION_GUIDE.md) for image configuration and [development notes](./DEVELOPMENT.md) for project behavior and participation rules.

## Figma Make configuration

Keep `.figma/` while this project is developed or previewed in Figma Make. The Vite configuration imports `.figma/make/site.json` for the page and sharing metadata, and Figma Make uses the scripts and configuration in `.figma/make/`.
