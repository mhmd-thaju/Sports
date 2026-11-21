# Cloudinary Setup and Operations

Cloudinary is used for participant photos and the event gallery. The Express server keeps Cloudinary credentials private; registration and Admin gallery uploads go through the server, while the hidden media-team page uses short-lived signed uploads for bulk files.

## 1. Cloudinary account and folders

1. In Cloudinary, note the **Cloud name**, **API key**, and **API secret**.
2. The app uses these folders (the server creates them when uploading):

   ```text
   dcas-sports-meet/
   ├── gallery/
   └── registrations/
       └── participants/
   ```

3. Keep the two image types separate. Folder separation is organizational, not a privacy boundary.

## 2. Configure secrets

The project already includes the `cloudinary` and `dotenv` dependencies. In the project-root `.env`, configure:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
MEDIA_UPLOAD_PASSWORD=use-a-long-unique-password
```

`.env` is ignored by Git. Set all four variables in the production server's secret/environment-variable settings as well. Never add the API secret to frontend code, a `VITE_` variable, public config, or a browser upload preset. Restart the server after changing environment variables. If Cloudinary credentials or the media password are missing, the corresponding server endpoints return an explicit configuration error.

## 3. Participant registration photos

Both house-captain registration (`POST /api/captain/register`) and Admin registration (`POST /api/admin/registration`) upload the selected image to `dcas-sports-meet/registrations/participants`. The database stores the Cloudinary `secure_url` and `public_id`, not the image's base64 data. A participant adding another event can reuse the existing Cloudinary photo; selecting a new photo updates their existing registration rows.

Registration photos use public Cloudinary URLs, as requested. Anyone who obtains a URL can view that photo; separate folders do not make the URL private. Obtain any consent required for participant photos, especially for minors.

## 4. Event gallery and media-team uploads

The Admin gallery upload stores event photos in `dcas-sports-meet/gallery`. The separate full gallery page (`#/gallery`) and homepage tiles use the newest gallery entries. All gallery entries are retained in the app database; the public gallery API returns display fields only and never includes registration photos or Cloudinary credentials. The existing **Our Campus** tile remains separate from event photos.

The media-team page is intentionally absent from navigation. Share this route after deployment:

```text
https://YOUR-PROJECT-DOMAIN/#/media-upload
```

Share the `MEDIA_UPLOAD_PASSWORD` with the media team through a separate channel. After password login, the server grants an in-memory session that expires after eight hours. Upload batches support up to 20 images (maximum 20 MB each), with up to three concurrent uploads. The server signs each upload for the fixed gallery folder, verifies it with Cloudinary, and only then adds its public URL and metadata to the gallery. The API secret never reaches the browser. Signing in again is required after a server restart.

Uploaded event photos and participant photos have public URLs. Do not share the media password publicly. If the password is exposed, replace it in the server environment and restart the server; existing sessions expire within eight hours.

## 5. Registration deletion

Admins can select and remove individual or multiple registration rows in the Admin Desk. House captains can do the same for registrations belonging to their own house. The server validates the complete batch before changing anything and prevents deletion while any selected event is published; unpublish the event first.

After deletion, the server removes a participant image from Cloudinary only when no remaining registration row references its `public_id`. Gallery image deletion is separate and removes both the gallery record and its Cloudinary asset.

## 6. Existing data and backups

New uploads are Cloudinary-backed. Existing records that already contain base64 photos are **not automatically migrated**; they continue to display until those registrations or gallery entries are replaced or removed. Back up `server/data/db.json` before production changes. If migrating existing photos, use a one-time migration that uploads registration and gallery data to their respective folders, saves the returned IDs/URLs, verifies each batch, and records failures for retry. Do not delete original data until the migration is checked.

The app's primary persistent database is still its server-side JSON file; Cloudinary stores the image files and the database stores their metadata. Configure persistent storage/backups for `server/data/db.json` on the hosting provider.

## 7. Deployment checks

1. Configure all four environment variables on the production server and restart it.
2. Confirm the Admin and captain registration flows succeed with a small consented test image. Verify its URL and `public_id` are under the registration folder and that it is absent from the public gallery.
3. Sign into `#/media-upload` with the separate password and upload a small batch. Confirm each photo appears on the homepage and full gallery and can be downloaded.
4. Verify an incorrect password, an expired session, a Cloudinary error, and an invalid or oversized image produce visible errors.
5. Test individual and bulk removals as both Admin and captain. Confirm a captain cannot remove another house's registrations, published events are protected, and shared participant photos remain in Cloudinary until the last registration is removed.
6. Confirm the Cloudinary API secret does not appear in built frontend assets, browser requests, public API responses, logs, or Git.

Do not run live Cloudinary test uploads unless you intend to create real account assets.
