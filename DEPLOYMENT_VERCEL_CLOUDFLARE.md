# Deploying the Sports Meet on Vercel and Cloudflare

This project has a Vite/React frontend and a separate Express API. The frontend can be published on Vercel or Cloudflare Pages. **The API must remain on a persistent Node.js host with one active instance** until its in-memory state and registration checks are redesigned for serverless/multi-instance operation.

## Important: deployment architecture

The Express API loads the Supabase database into process memory and persists writes from that state. Registration limits are serialized within one process, not across multiple server instances.

- Do not deploy the current `server/index.js` as a Vercel Function and assume the database state is safe. Vercel scales Functions, while this API requires one consistent state cache.
- Do not run the Express server unchanged in a Cloudflare Worker. Workers have a different request/runtime model and only a subset of Node.js APIs.
- Use one persistent Node API service, configured for a single instance, and deploy the static frontend to Vercel, Cloudflare Pages, or both. Both frontends can proxy `/api/*` to that API.
- A fully serverless API requires a separate refactor: stateless data access and database transactions/locking for registration rules.

Before deploying, rotate any credentials that have been shared in chat, logs, or source control. Configure new values directly in each provider's secret settings; do not copy real values into this guide, source code, or `VITE_` variables.

## 1. Deploy the Express API

Choose a Node.js host that supports a continuously running Express process. Configure its start command as:

```sh
pnpm run server
```

Set Node.js 22, install with `pnpm install --frozen-lockfile`, and configure these variables in the API host's **server-side environment settings**:

```dotenv
NODE_ENV=production
STORAGE_BACKEND=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
ADMIN_PIN=YOUR_NEW_UNIQUE_ADMIN_PIN
JUDGE_PIN=YOUR_NEW_DIFFERENT_JUDGE_PIN
ADMIN_NAME=George
JUDGE_NAME=Judge
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_SERVER_ONLY_CLOUDINARY_SECRET
MEDIA_UPLOAD_PASSWORD=YOUR_NEW_MEDIA_TEAM_PASSWORD
```

Use distinct admin and judge PINs of at least eight characters. Keep the Supabase service-role key and Cloudinary API secret on the API host only. `PORT` is supplied by most Node hosts; the API listens on it.

Keep the API to **one active instance**. Supabase stores persistent data, so a local disk is not required for production when Supabase mode is enabled. Follow the [Supabase database and hosting guide](./SUPABASE_DATABASE_AND_HOSTING_GUIDE.md) for schema and data migration. Do not rerun the initial import against a non-empty database.

After deployment, check the API directly:

```powershell
curl.exe -i https://YOUR_API_HOST/api/config
```

The response should be JSON. Use an HTTPS API domain.

## 2. Deploy the frontend to Vercel

### Configure the API proxy

The frontend calls same-origin `/api/...` URLs. In the repository root, create `vercel.json` and replace the example API host:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_API_HOST/api/:path*"
    }
  ]
}
```

This forwards API requests through Vercel without exposing a service credential in the browser. The destination must be the API origin, with `/api` included as shown.

### Deploy with the Vercel CLI

Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link
pnpm dlx vercel@latest deploy --prod
```

On the first deployment, follow the prompts to link or create the Vercel project. In **Project Settings → Build and Deployment**, use:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Root directory | `.` |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm run build` |
| Output directory | `dist` |

No Supabase or Cloudinary secrets belong in Vercel's frontend build variables. They belong only in the persistent API host's settings.

## 3. Deploy the frontend to Cloudflare Pages

Cloudflare Pages redirects cannot proxy to external domains. For same-origin `/api` requests, use a Pages Function as a small reverse proxy to the persistent API.

Create `functions/api/[[path]].js` at the repository root (the `functions` folder must be beside `src`, not inside `dist`):

```js
export async function onRequest({ request, env }) {
  const incoming = new URL(request.url);
  const apiOrigin = new URL(env.API_ORIGIN);
  const upstream = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);
  return fetch(new Request(upstream, request));
}
```

Set `API_ORIGIN` to the HTTPS API origin only, for example `https://sports-api.example.com`—do not add `/api`. The function forwards `/api/...` to the same path on the Express API. Add `API_ORIGIN` under the Pages project's **Settings → Variables and Secrets → Functions** for both Production and Preview. It is a host name, not a credential.

### Deploy with Git integration

1. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git** and select this repository.
2. Set the production branch used by your project.
3. Configure the build:

   | Setting | Value |
   |---|---|
   | Root directory | `/` |
   | Build command | `pnpm run build` |
   | Build output directory | `dist` |

4. Add the `API_ORIGIN` Functions variable for Production and Preview.
5. Push the deployment commit to the production branch:

   ```sh
   git push origin YOUR_PRODUCTION_BRANCH
   ```

Cloudflare Pages will build the Vite site and deploy the `functions/` API proxy with it. Avoid dashboard drag-and-drop Direct Upload for this setup; Pages Functions are needed to proxy the API.

### Deploy with Wrangler

Wrangler can create and deploy a Pages project from the repository:

```sh
pnpm dlx wrangler@latest login
pnpm dlx wrangler@latest pages project create
pnpm install --frozen-lockfile
pnpm run build
pnpm dlx wrangler@latest pages deploy dist --project-name YOUR_PAGES_PROJECT
```

Follow the project-creation prompts. Configure `API_ORIGIN` in the Pages project's Functions variables before relying on the proxy. The Pages Function source must remain in the root `functions/` directory.

To test the Pages build and Function locally, after setting the API origin:

```sh
pnpm run build
pnpm dlx wrangler@latest pages dev dist --port 8788 --binding API_ORIGIN=https://YOUR_API_HOST
```

Then open `http://localhost:8788` and test an API request.

## 4. Verify each deployment

For each frontend domain, verify the site and API proxy:

```powershell
curl.exe -i https://YOUR_FRONTEND_DOMAIN/
curl.exe -i https://YOUR_FRONTEND_DOMAIN/api/config
```

Then test the public results, points, and gallery pages; admin and judge PIN login; captain login and registration; media-team upload; and registration deletion. Confirm:

- The frontend's `/api/config` request returns JSON from the Express API.
- Admin, judge, captain, and media actions succeed only with their credentials.
- Both frontends use the same API and Supabase project.
- The API runs as one active instance.
- No Supabase service-role key or Cloudinary API secret appears in frontend source, built assets, or browser requests.
- No production import/migration command is being run as part of normal deployment.

The media-team page remains unlisted in navigation; after deployment its route is `https://YOUR_FRONTEND_DOMAIN/#/media-upload`. Share the route and media password only with the media team through separate channels.

## Platform documentation

- [Vercel Express deployment](https://vercel.com/docs/frameworks/backend/express)
- [Vercel external rewrites](https://vercel.com/docs/routing/rewrites)
- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare Pages Function routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Cloudflare Workers Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
