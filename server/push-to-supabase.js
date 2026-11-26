import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.SPORTSMEET_DB_FILE
  ? path.resolve(process.env.SPORTSMEET_DB_FILE)
  : path.join(here, "data", "db.json");
const tables = [
  "tournament_config",
  "houses",
  "captains",
  "events",
  "students",
  "registrations",
  "results",
  "judge_submissions",
  "legacy_scores",
  "gallery_photos",
  "audit_logs",
];
const primaryKeys = {
  tournament_config: "id",
  houses: "name",
  events: "id",
  students: "reg_no",
  registrations: "id",
  results: "event_id",
  judge_submissions: "event_id",
  legacy_scores: "id",
  gallery_photos: "id",
  audit_logs: "id",
};
const defaultHouses = [
  "BCom Co-operation",
  "BA Economics",
  "BCom Finance & BBA",
  "GDA, BCA & Psychology",
];
const defaultPoints = [5, 3, 1];
const defaultCategoryPoints = { Athletics: [5, 3, 1], Games: [10, 6, 0] };
const normalizeReg = (value) => String(value || "").trim().toUpperCase();
const stableUuid = (value) => {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hash[12] = "5";
  hash[16] = ((parseInt(hash[16], 16) & 3) | 8).toString(16);
  const hex = hash.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

function requireCredentials() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  try {
    const url = new URL(process.env.SUPABASE_URL);
    if (url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTPS URL");
  }
}

export function createPayload(database) {
  const config = database.config || {};
  const registrations = Array.isArray(database.regs) ? database.regs : [];
  const events = Array.isArray(database.events) ? database.events : [];
  const configuredHouses =
    Array.isArray(config.houses) && config.houses.length ? config.houses : defaultHouses;
  const captainHouses = (config.captains || []).map((captain) => captain.house).filter(Boolean);
  const houses = [...new Set([
    ...configuredHouses,
    ...registrations.map((row) => row.house).filter(Boolean),
    ...captainHouses,
  ])];
  const students = new Map();

  for (const registration of registrations) {
    const regNo = normalizeReg(registration.reg);
    const previous = students.get(regNo);
    const currentTime = Date.parse(registration.registeredAt || "") || 0;
    const previousTime = Date.parse(previous?.registeredAt || "") || 0;
    if (!previous || currentTime >= previousTime) {
      students.set(regNo, { ...registration, regNo });
    }
  }

  const migrationEvents = events.map((event) => ({
    id: String(event.id),
    name: String(event.name),
    category: event.category,
    gender: event.gender,
    event_type: event.type || "track",
    points: Array.isArray(event.points) ? event.points : defaultPoints,
    registration_open: event.registrationOpen !== false,
  }));
  const studentRows = [...students.values()].map((student) => ({
    reg_no: student.regNo,
    full_name: String(student.name || ""),
    house_name: String(student.house || ""),
    gender: student.gender,
    picture_url: /^https:\/\//i.test(String(student.picture || "")) ? student.picture : null,
    picture_public_id: /^https:\/\//i.test(String(student.picture || "")) ? student.picturePublicId || null : null,
    created_at: student.registeredAt || new Date().toISOString(),
    updated_at: student.registeredAt || new Date().toISOString(),
    _picture_source: String(student.picture || ""),
  }));
  const registrationRows = registrations.map((registration, index) => ({
    id: String(registration.id || `registration-${index}-${normalizeReg(registration.reg)}`),
    reg_no: normalizeReg(registration.reg),
    event_id: String(registration.eventId),
    registered_at: registration.registeredAt || new Date().toISOString(),
  }));

  for (const student of studentRows) {
    if (!student.reg_no || !student.full_name || !student.house_name) {
      throw new Error("A registration is missing required student fields");
    }
    if (!["Boys", "Girls"].includes(student.gender)) {
      throw new Error("A participant has a gender unsupported by the Supabase schema");
    }
  }
  for (const event of migrationEvents) {
    if (!event.id || !event.name || !["Athletics", "Games"].includes(event.category) ||
        !["Boys", "Girls", "Mixed"].includes(event.gender)) {
      throw new Error("An event does not match the Supabase schema constraints");
    }
  }

  const results = Object.entries(database.results || {}).map(([eventId, result]) => ({
    event_id: eventId,
    places: result.places || [],
    published_at: result.at || new Date().toISOString(),
  }));
  const judgeName = String(process.env.JUDGE_NAME || "Judge").trim() || "Judge";
  const submissions = Object.entries(database.judgeSubmissions || {}).map(([eventId, submission]) => ({
    event_id: eventId,
    judge_name: judgeName,
    positions: submission.positions || [],
    submitted_at: submission.submittedAt || new Date().toISOString(),
  }));
  const scores = (database.scores || []).map((score, index) => ({
    id: String(score.id || `legacy-${index}-${score.eventId}-${score.reg}`),
    event_id: String(score.eventId),
    reg_no: String(score.reg || ""),
    judge_name: judgeName,
    score: Number(score.score) || 0,
    scored_at: score.scoredAt || new Date().toISOString(),
  }));
  const galleryPhotos = (config.gallery || [])
    .filter((photo) => /^https:\/\//i.test(String(photo.src || "")) || /^data:image\//i.test(String(photo.src || "")))
    .map((photo) => ({
      id: String(photo.id || randomUUID()),
      caption: String(photo.caption || ""),
      secure_url: photo.src,
      public_id: photo.publicId || null,
      uploaded_at: photo.uploadedAt || photo.at || new Date().toISOString(),
      width: photo.width || null,
      height: photo.height || null,
      format: photo.format || null,
      bytes: photo.bytes || null,
    }));
  const logs = (database.auditLogs || []).map((log) => ({
    id: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(log.id || ""))
      ? log.id
      : stableUuid(JSON.stringify(log)),
    occurred_at: log.at || new Date().toISOString(),
    actor_type: log.type || "visitor",
    actor_id: log.actorId || "",
    actor_name: log.name || "Unknown",
    action: log.action || "unknown",
    entity_type: log.entityType || null,
    entity_id: log.entityId || null,
    subject_reg: log.subjectReg || null,
    summary: log.summary || "",
  }));

  return {
    tournament_config: [{
      id: "current",
      name: config.name || "DCAS Sports Meet 2026",
      max_events_per_student: Math.max(1, Math.trunc(Number(config.maxEventsPerStudent) || 3)),
      categories: config.categories || ["Athletics", "Games"],
      genders: config.genders || ["Boys", "Girls"],
      category_points: config.categoryPoints || defaultCategoryPoints,
      default_points: config.defaultPoints || defaultPoints,
      live_day: config.liveDay || "Day 2",
      schedule: config.schedule || [],
      featured_winners: config.featuredWinners || [],
    }],
    houses: houses.map((name, display_order) => ({ name, display_order })),
    events: migrationEvents,
    students: studentRows,
    registrations: registrationRows,
    results,
    judge_submissions: submissions,
    legacy_scores: scores,
    gallery_photos: galleryPhotos,
    audit_logs: logs,
  };
}

function getClientConfig() {
  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  if (cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  return { cloudinaryConfigured };
}

async function uploadImages(payload, cloudinaryConfigured) {
  const images = new Map();
  for (const student of payload.students) {
    const image = student._picture_source;
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(image)) continue;
    if (!cloudinaryConfigured) {
      throw new Error("Cloudinary credentials are required to migrate embedded participant photos");
    }
    if (!images.has(image)) {
      try {
        images.set(image, await cloudinary.uploader.upload(image, {
          folder: "dcas-sports-meet/registrations/participants",
          asset_folder: "dcas-sports-meet/registrations/participants",
          resource_type: "image",
        }));
      } catch (error) {
        throw new Error(`Cloudinary participant photo upload failed (${error.name || "Error"})`);
      }
    }
    const uploaded = images.get(image);
    student.picture_url = uploaded.secure_url;
    student.picture_public_id = uploaded.public_id;
  }
  for (const student of payload.students) delete student._picture_source;

  const galleryImages = new Map();
  for (const photo of payload.gallery_photos) {
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(String(photo.secure_url))) continue;
    if (!cloudinaryConfigured) {
      throw new Error("Cloudinary credentials are required to migrate embedded gallery photos");
    }
    if (!galleryImages.has(photo.secure_url)) {
      try {
        galleryImages.set(photo.secure_url, await cloudinary.uploader.upload(photo.secure_url, {
          folder: "dcas-sports-meet/gallery",
          asset_folder: "dcas-sports-meet/gallery",
          resource_type: "image",
        }));
      } catch (error) {
        throw new Error(`Cloudinary gallery photo upload failed (${error.name || "Error"})`);
      }
    }
    const uploaded = galleryImages.get(photo.secure_url);
    photo.secure_url = uploaded.secure_url;
    photo.public_id = uploaded.public_id;
  }
  return {
    participantPhotos: images.size,
    galleryPhotos: galleryImages.size,
  };
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function requestTable(table, { method = "GET", rows, conflict, count = false } = {}) {
  const url = new URL(`/rest/v1/${table}`, process.env.SUPABASE_URL);
  if (conflict) url.searchParams.set("on_conflict", conflict);
  else url.searchParams.set("select", "*");
  const headers = supabaseHeaders({
    Prefer: count ? "count=exact" : "resolution=merge-duplicates,return=minimal",
  });
  if (count) headers.Range = "0-0";
  if (rows) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    method,
    headers,
    body: rows ? JSON.stringify(rows) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    let code = "";
    try { code = (await response.json()).code || ""; } catch {}
    throw new Error(`Supabase ${method} failed for ${table} (HTTP ${response.status}${code ? `, ${code}` : ""})`);
  }
  return response;
}

async function countRows(table) {
  const response = await requestTable(table, { count: true });
  const range = response.headers.get("content-range") || "";
  const count = Number(range.slice(range.lastIndexOf("/") + 1));
  if (!Number.isInteger(count)) throw new Error(`Could not verify the row count for ${table}`);
  return count;
}

async function verifyEmptyTarget() {
  const counts = {};
  for (const table of tables) {
    counts[table] = await countRows(table);
  }
  const populated = Object.entries(counts).filter(([, count]) => count > 0);
  if (populated.length) {
    throw new Error(`Refusing to overwrite a non-empty Supabase project (${populated.map(([table]) => table).join(", ")})`);
  }
}

async function upsertRows(table, rows) {
  if (!rows.length) return;
  const chunks = [];
  for (let index = 0; index < rows.length; index += 250) chunks.push(rows.slice(index, index + 250));
  for (const chunk of chunks) {
    await requestTable(table, {
      method: "POST",
      rows: chunk,
      conflict: primaryKeys[table] || "id",
    });
  }
}

async function main() {
  requireCredentials();
  if (!fs.existsSync(dbPath)) throw new Error(`Local database not found: ${dbPath}`);
  const database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  const payload = createPayload(database);
  const plan = Object.fromEntries(tables.map((table) => [table, payload[table]?.length || 0]));
  const apply = process.argv.includes("--apply");
  console.log(apply ? "Supabase data migration: APPLY" : "Supabase data migration: DRY RUN");
  console.log(`Local database: ${path.relative(process.cwd(), dbPath)}`);
  console.log(`Rows to import: ${Object.entries(plan).map(([table, count]) => `${table}=${count}`).join(", ")}`);
  if (!apply) {
    console.log("No data written. Re-run with --apply to import after reviewing the counts.");
    return;
  }

  await verifyEmptyTarget();
  const { cloudinaryConfigured } = getClientConfig();
  const photoCounts = await uploadImages(payload, cloudinaryConfigured);
  console.log(`Uploaded embedded photos to Cloudinary: participants=${photoCounts.participantPhotos}, gallery=${photoCounts.galleryPhotos}`);

  const order = [
    "houses",
    "tournament_config",
    "events",
    "students",
    "registrations",
    "results",
    "judge_submissions",
    "legacy_scores",
    "gallery_photos",
    "audit_logs",
  ];
  for (const table of order) await upsertRows(table, payload[table] || []);

  const mismatches = [];
  for (const table of tables) {
    const actual = await countRows(table);
    const expected = payload[table]?.length || 0;
    if (actual !== expected) mismatches.push(`${table} expected ${expected}, found ${actual}`);
  }
  if (mismatches.length) throw new Error(`Post-migration verification failed: ${mismatches.join("; ")}`);
  console.log("Migration complete. Every table count matches the local export.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
