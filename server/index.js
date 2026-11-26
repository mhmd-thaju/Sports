// DCAS Sports Meet API. Zero-config JSON storage; easily migratable to Supabase/PostgreSQL/Turso.
import "dotenv/config";
import express from "express";
import { v2 as cloudinary } from "cloudinary";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hashCaptainPassword,
  loadSupabaseDatabase,
  persistSupabaseDatabase,
  verifyCaptainPassword,
} from "./supabaseStore.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB = process.env.SPORTSMEET_DB_FILE
  ? path.resolve(process.env.SPORTSMEET_DB_FILE)
  : path.join(dataDir, "db.json");
const hasSupabaseConfig = Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY);
const STORAGE_BACKEND = process.env.TEST === "1"
  ? "json"
  : process.env.STORAGE_BACKEND || (hasSupabaseConfig || process.env.NODE_ENV === "production" ? "supabase" : "json");
const SUPABASE_MODE = STORAGE_BACKEND === "supabase" && process.env.TEST !== "1";
if (STORAGE_BACKEND !== "json" && STORAGE_BACKEND !== "supabase") {
  throw new Error("STORAGE_BACKEND must be either json or supabase");
}
if (STORAGE_BACKEND === "json") fs.mkdirSync(path.dirname(DB), { recursive: true });
const CLOUDINARY_GALLERY_FOLDER = "dcas-sports-meet/gallery";
const CLOUDINARY_REGISTRATION_FOLDER = "dcas-sports-meet/registrations/participants";
const pendingRegistrationPhotos = new Map();
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
const mediaSessions = new Map();
const mediaLoginAttempts = new Map();
const MEDIA_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PIN = { judge: process.env.JUDGE_PIN, admin: process.env.ADMIN_PIN };
const ADMIN_NAME = String(process.env.ADMIN_NAME || "George").trim() || "George";
const JUDGE_NAME = String(process.env.JUDGE_NAME || "Judge").trim() || "Judge";

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const defaultHouses = [
  "BCom Co-operation",
  "BA Economics",
  "BCom Finance & BBA",
  "GDA, BCA & Psychology"
];

const defaultCategoryPoints = {
  Athletics: [5, 3, 1],
  Games: [10, 6, 0],
};
const defaultPoints = [5, 3, 1];

// Default 30 items faithfully sourced from Sportsitem.txt
export const defaultEvents = [
  // Athletics - Boys (Points: 5, 3, 1)
  { id: "ath-100m-boys", name: "100m", category: "Athletics", gender: "Boys", type: "track", points: [5, 3, 1] },
  { id: "ath-200m-boys", name: "200m", category: "Athletics", gender: "Boys", type: "track", points: [5, 3, 1] },
  { id: "ath-400m-boys", name: "400m", category: "Athletics", gender: "Boys", type: "track", points: [5, 3, 1] },
  { id: "ath-1500m-boys", name: "1500m", category: "Athletics", gender: "Boys", type: "track", points: [5, 3, 1] },
  { id: "ath-highjump-boys", name: "Highjump", category: "Athletics", gender: "Boys", type: "field", points: [5, 3, 1] },
  { id: "ath-longjump-boys", name: "Longjump", category: "Athletics", gender: "Boys", type: "field", points: [5, 3, 1] },
  { id: "ath-shotput-boys", name: "Shotput", category: "Athletics", gender: "Boys", type: "field", points: [5, 3, 1] },
  { id: "ath-discusthrow-boys", name: "Discus Throw", category: "Athletics", gender: "Boys", type: "field", points: [5, 3, 1] },
  { id: "ath-javelin-boys", name: "Javelin", category: "Athletics", gender: "Boys", type: "field", points: [5, 3, 1] },
  { id: "ath-4x100mrelay-boys", name: "4 x 100m Relay", category: "Athletics", gender: "Boys", type: "team", points: [5, 3, 1] },

  // Athletics - Girls (Points: 5, 3, 1)
  { id: "ath-100m-girls", name: "100m", category: "Athletics", gender: "Girls", type: "track", points: [5, 3, 1] },
  { id: "ath-200m-girls", name: "200m", category: "Athletics", gender: "Girls", type: "track", points: [5, 3, 1] },
  { id: "ath-400m-girls", name: "400m", category: "Athletics", gender: "Girls", type: "track", points: [5, 3, 1] },
  { id: "ath-600m-girls", name: "600m", category: "Athletics", gender: "Girls", type: "track", points: [5, 3, 1] },
  { id: "ath-highjump-girls", name: "Highjump", category: "Athletics", gender: "Girls", type: "field", points: [5, 3, 1] },
  { id: "ath-longjump-girls", name: "Longjump", category: "Athletics", gender: "Girls", type: "field", points: [5, 3, 1] },
  { id: "ath-shotput-girls", name: "Shotput", category: "Athletics", gender: "Girls", type: "field", points: [5, 3, 1] },
  { id: "ath-discusthrow-girls", name: "Discus Throw", category: "Athletics", gender: "Girls", type: "field", points: [5, 3, 1] },
  { id: "ath-javelin-girls", name: "Javelin", category: "Athletics", gender: "Girls", type: "field", points: [5, 3, 1] },
  { id: "ath-4x100mrelay-girls", name: "4 x 100m Relay", category: "Athletics", gender: "Girls", type: "team", points: [5, 3, 1] },

  // Games - Boys (Points: 10, 6, 0)
  { id: "game-football-boys", name: "Football", category: "Games", gender: "Boys", type: "team", points: [10, 6, 0] },
  { id: "game-cricket-boys", name: "Cricket", category: "Games", gender: "Boys", type: "team", points: [10, 6, 0] },
  { id: "game-volleyball-boys", name: "Volleyball", category: "Games", gender: "Boys", type: "team", points: [10, 6, 0] },
  { id: "game-badminton-boys", name: "Badminton", category: "Games", gender: "Boys", type: "court", points: [10, 6, 0] },
  { id: "game-chess-boys", name: "Chess", category: "Games", gender: "Boys", type: "court", points: [10, 6, 0] },

  // Games - Girls (Points: 10, 6, 0)
  { id: "game-throwball-girls", name: "Throwball", category: "Games", gender: "Girls", type: "team", points: [10, 6, 0] },
  { id: "game-badminton-girls", name: "Badminton", category: "Games", gender: "Girls", type: "court", points: [10, 6, 0] },
  { id: "game-minidodgeball-girls", name: "Mini Dodgeball", category: "Games", gender: "Girls", type: "team", points: [10, 6, 0] },
  { id: "game-khokho-girls", name: "Kho-Kho", category: "Games", gender: "Girls", type: "team", points: [10, 6, 0] },
  { id: "game-chess-girls", name: "Chess", category: "Games", gender: "Girls", type: "court", points: [10, 6, 0] },
];

function canonicalizeEvents(events) {
  const stored = new Map((Array.isArray(events) ? events : []).map((event) => [event.id, event]));
  return defaultEvents.map((standard) => {
    const event = stored.get(standard.id);
    const storedPoints =
      standard.category === "Games" && JSON.stringify(event?.points) === JSON.stringify([10, 5, 2])
        ? [10, 6, 0]
        : Array.isArray(event?.points) && event.points.length === 3
          ? event.points.map(Number)
          : standard.points;
    return event
      ? {
          ...standard,
          type: event.type || standard.type,
          points: storedPoints,
          registrationOpen: event.registrationOpen !== false,
        }
      : { ...standard, points: [...standard.points] };
  });
}

let db = {
  config: {
    name: "DCAS Sports Meet 2026",
    houses: defaultHouses,
    maxEventsPerStudent: 3,
    categories: ["Athletics", "Games"],
    genders: ["Boys", "Girls"],
    categoryPoints: defaultCategoryPoints,
    defaultPoints: defaultPoints,
    captains: [],
    gallery: [],
    liveDay: "Day 2",
    schedule: [],
    featuredWinners: [],
  },
  events: defaultEvents,
  regs: [],
  scores: [],
  judgeSubmissions: {},
  results: {},
  auditLogs: [],
};

if (STORAGE_BACKEND === "json" && fs.existsSync(DB)) {
  try {
    const disk = JSON.parse(fs.readFileSync(DB, "utf8"));
    db = {
      config: {
        name: disk.config?.name || "DCAS Sports Meet 2026",
        houses: disk.config?.houses || defaultHouses,
        maxEventsPerStudent: disk.config?.maxEventsPerStudent || 3,
        categories: disk.config?.categories || ["Athletics", "Games"],
        genders: disk.config?.genders || ["Boys", "Girls"],
        categoryPoints: disk.config?.categoryPoints || defaultCategoryPoints,
        defaultPoints: disk.config?.defaultPoints || defaultPoints,
        captains: Array.isArray(disk.config?.captains) ? disk.config.captains : [],
        gallery: Array.isArray(disk.config?.gallery) ? disk.config.gallery : [],
        liveDay: String(disk.config?.liveDay || "Day 2"),
        schedule: Array.isArray(disk.config?.schedule) ? disk.config.schedule : [],
        featuredWinners: Array.isArray(disk.config?.featuredWinners) ? disk.config.featuredWinners : [],
      },
      events: canonicalizeEvents(disk.events),
      regs: Array.isArray(disk.regs) ? disk.regs : [],
      scores: Array.isArray(disk.scores) ? disk.scores : [],
      judgeSubmissions: disk.judgeSubmissions && typeof disk.judgeSubmissions === "object" ? disk.judgeSubmissions : {},
      results: disk.results && typeof disk.results === "object" ? disk.results : {},
      auditLogs: Array.isArray(disk.auditLogs) ? disk.auditLogs : [],
    };
  } catch (err) {
    console.error("Failed to parse existing db.json, using defaults", err);
  }
}

if (JSON.stringify(db.config.categoryPoints?.Games) === JSON.stringify([10, 5, 2])) {
  db.config.categoryPoints = { ...db.config.categoryPoints, Games: [10, 6, 0] };
}

for (const submission of Object.values(db.judgeSubmissions)) {
  if (submission && typeof submission === "object") submission.judge = JUDGE_NAME;
}

let persistenceQueue = Promise.resolve();

export const save = async () => {
  if (SUPABASE_MODE) {
    db.config.captains = (db.config.captains || []).map((captain) => {
      if (captain.passwordHash) return captain;
      if (!captain.password) throw new Error("A house captain password is missing");
      const { password, ...rest } = captain;
      return { ...rest, passwordHash: hashCaptainPassword(password) };
    });
    const snapshot = JSON.parse(JSON.stringify(db));
    const next = persistenceQueue.catch(() => {}).then(() => persistSupabaseDatabase(snapshot));
    persistenceQueue = next;
    try {
      await next;
    } catch (error) {
      try {
        db = await loadSupabaseDatabase();
      } catch (reloadError) {
        console.error("Could not reload Supabase state after a failed write:", reloadError.message);
      }
      throw error;
    }
    return;
  }

  try {
    fs.writeFileSync(DB + ".tmp", JSON.stringify(db, null, 2));
    fs.renameSync(DB + ".tmp", DB);
  } catch (err) {
    try {
      fs.writeFileSync(DB, JSON.stringify(db, null, 2));
    } catch (e2) {
      console.warn("Notice: Local file write warning:", e2.message);
    }
  }
};

const normalizedEvents = SUPABASE_MODE ? db.events : canonicalizeEvents(db.events);
if (JSON.stringify(normalizedEvents) !== JSON.stringify(db.events)) {
  db.events = normalizedEvents;
  if (!SUPABASE_MODE) void save();
} else {
  db.events = normalizedEvents;
}

// Initial save if DB file does not exist
if (!SUPABASE_MODE && !fs.existsSync(DB)) {
  void save();
}

const auth = (role) => (q, s, n) => {
  const expected = role === "admin" ? PIN.admin : PIN.judge;
  if (!expected || !constantTimeEqual(q.get("x-pin"), expected)) {
    return s.status(401).json({ error: "Wrong PIN" });
  }
  q.auditActor = {
    type: role,
    id: role === "admin" ? "admin" : "judge",
    name: role === "admin" ? ADMIN_NAME : JUDGE_NAME,
  };
  n();
};
const bad = (s, m) => s.status(400).json({ error: m });
const norm = (v) => String(v || "").trim().toUpperCase();
const isImageDataUrl = (value) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || ""));

function validateRequiredSecrets() {
  if (!PIN.admin || !PIN.judge) {
    throw new Error("ADMIN_PIN and JUDGE_PIN must be configured before the API can start");
  }
  if (PIN.admin.length < 8 || PIN.judge.length < 8) {
    throw new Error("ADMIN_PIN and JUDGE_PIN must each be at least 8 characters");
  }
  if (constantTimeEqual(PIN.admin, PIN.judge)) {
    throw new Error("ADMIN_PIN and JUDGE_PIN must be different");
  }
}

function validateStorageConfig() {
  if (process.env.NODE_ENV === "production" && STORAGE_BACKEND !== "supabase") {
    throw new Error("Production requires STORAGE_BACKEND=supabase");
  }
  if (STORAGE_BACKEND !== "supabase") return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage");
  }
  let url;
  try {
    url = new URL(process.env.SUPABASE_URL);
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS");
}

export async function initializeDatabase() {
  validateStorageConfig();
  if (!SUPABASE_MODE) return;
  db = await loadSupabaseDatabase();
  for (const submission of Object.values(db.judgeSubmissions)) {
    if (submission && typeof submission === "object") submission.judge = JUDGE_NAME;
  }
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeAuditText(value, limit) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
}

function appendActivityLog(entry) {
  const { id: actorId, ...activity } = entry;
  db.auditLogs.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    type: safeAuditText(activity.type || "visitor", 32),
    actorId: safeAuditText(actorId, 120),
    name: safeAuditText(activity.name || "Unknown", 120),
    action: safeAuditText(activity.action || "unknown", 80),
    entityType: safeAuditText(activity.entityType, 80),
    entityId: safeAuditText(activity.entityId, 160),
    subjectReg: safeAuditText(activity.subjectReg, 80),
    summary: safeAuditText(activity.summary, 300),
  });
  void save().catch((error) => console.error("Could not persist activity log:", error.message));
}

function activityForRequest(q, response) {
  const route = q.path.replace(/^\/api/, "");
  const method = q.method;
  const actor = q.auditActor;
  const captain = actor ? null : getCaptain(q);
  const currentActor = actor || (captain ? {
    type: "captain",
    id: captain.username,
    name: `${captain.name || captain.username} · ${captain.house}`,
  } : null);

  if (method === "POST" && route === "/auth/verify" && currentActor) {
    return { ...currentActor, action: `${currentActor.type}_login`, summary: "Authenticated successfully" };
  }
  if (method === "POST" && route === "/captain/login" && currentActor) {
    return { ...currentActor, action: "captain_login", summary: "House captain signed in" };
  }
  if (method === "GET" && route.startsWith("/student/")) {
    const reg = String(route.slice("/student/".length) || "").trim().toUpperCase();
    return {
      type: "student_lookup",
      id: "anonymous",
      name: "Points lookup",
      action: "student_points_lookup",
      entityType: "student",
      entityId: reg,
      subjectReg: reg,
      summary: `Points requested for register number ${reg}${response.statusCode === 404 ? " (no matching registration)" : ""}`,
    };
  }
  if (method === "GET" && route === "/entries/" + q.params?.eid && currentActor?.type === "judge") {
    return { ...currentActor, action: "judge_event_opened", entityType: "event", entityId: String(q.params?.eid || ""), summary: "Viewed the event entries" };
  }
  if (method === "POST" && route.startsWith("/activity/gallery/")) {
    const photoId = route.slice("/activity/gallery/".length);
    const action = q.body?.action === "download_click" ? "gallery_download_click" : "gallery_open";
    return {
      type: "gallery_visitor",
      id: "anonymous",
      name: "Gallery visitor",
      action,
      entityType: "gallery_photo",
      entityId: photoId,
      summary: action === "gallery_open" ? "Opened an event photo" : "Clicked an event photo download",
    };
  }
  if (!currentActor) return null;

  if (method === "POST" && route === "/admin/registration") {
    const reg = String(q.body?.reg || "").trim().toUpperCase();
    const eventCount = Array.isArray(q.body?.eventIds) ? q.body.eventIds.length : 0;
    return { ...currentActor, action: "registration_added", entityType: "student", entityId: reg, subjectReg: reg, summary: `Added ${String(q.body?.name || "participant")} (${reg}) to ${eventCount} event(s)` };
  }
  if (method === "POST" && route === "/captain/register") {
    const reg = String(q.body?.reg || "").trim().toUpperCase();
    const eventCount = Array.isArray(q.body?.eventIds) ? q.body.eventIds.length : 0;
    return { ...currentActor, action: "registration_added", entityType: "student", entityId: reg, subjectReg: reg, summary: `Added ${String(q.body?.name || "participant")} (${reg}) to ${eventCount} event(s)` };
  }
  if (method === "POST" && (route === "/admin/registration/bulk" || route === "/captain/register-bulk")) {
    const rows = Array.isArray(q.body?.rows) ? q.body.rows : [];
    const eventCount = rows.reduce((count, row) => count + (Array.isArray(row?.eventIds) ? row.eventIds.length : 0), 0);
    return {
      ...currentActor,
      action: "registrations_bulk_added",
      entityType: "student",
      summary: `Bulk registered ${rows.length} participant(s) across ${eventCount} event registration(s)`,
    };
  }
  if ((method === "POST" && route === "/unregister/" + q.params?.id) || (method === "POST" && route === "/captain/unregister/" + q.params?.id)) {
    return { ...currentActor, action: "registration_removed", entityType: "registration", entityId: String(q.params?.id || ""), summary: "Removed a participant registration" };
  }
  if (method === "POST" && (route === "/admin/unregister-bulk" || route === "/captain/unregister-bulk")) {
    const count = Array.isArray(q.body?.ids) ? q.body.ids.length : 0;
    return { ...currentActor, action: "registrations_removed", entityType: "registration", summary: `Bulk removal request for ${count} registration(s)` };
  }
  if (method === "POST" && route === "/judge/submit/" + q.params?.eid) {
    return { ...currentActor, action: "judge_submission", entityType: "event", entityId: String(q.params?.eid || ""), summary: `Submitted placings for ${Array.isArray(q.body?.positions) ? q.body.positions.length : 0} participant(s) or team(s)` };
  }
  if (method === "POST" && route === "/score") {
    return { ...currentActor, action: "judge_score_submitted", entityType: "event", entityId: String(q.body?.eventId || ""), summary: "Submitted an event score" };
  }
  if (method === "POST" && route === "/media/login") {
    return { ...currentActor, action: "media_login", summary: "Media Team signed in" };
  }
  if (method === "POST" && route === "/media/logout") {
    return { ...currentActor, action: "media_logout", summary: "Media Team signed out" };
  }
  if (method === "POST" && route === "/media/complete") {
    const count = Array.isArray(q.body?.publicIds) ? q.body.publicIds.length : 0;
    return { ...currentActor, action: "gallery_batch_uploaded", entityType: "gallery", summary: `Published ${count} gallery photo(s)` };
  }
  if (method === "POST" && route === "/admin/teams") {
    return { ...currentActor, action: "houses_updated", entityType: "houses", summary: `Updated ${Array.isArray(q.body?.houses) ? q.body.houses.length : 0} house name(s)` };
  }
  if (method === "POST" && route === "/admin/site-content") {
    return { ...currentActor, action: "site_content_updated", entityType: "site_content", summary: "Updated the live-day label, schedule, or featured winners" };
  }
  if (method === "POST" && route === "/admin/captains") {
    return { ...currentActor, action: "captains_updated", entityType: "captains", summary: `Updated credentials for ${Array.isArray(q.body?.captains) ? q.body.captains.length : 0} house captain(s)` };
  }
  if (method === "POST" && route === "/admin/gallery") {
    return { ...currentActor, action: "gallery_photo_uploaded", entityType: "gallery", summary: "Uploaded a gallery photo" };
  }
  if (method === "DELETE" && route.startsWith("/admin/gallery/")) {
    return { ...currentActor, action: "gallery_photo_deleted", entityType: "gallery_photo", entityId: route.slice("/admin/gallery/".length), summary: "Deleted a gallery photo" };
  }
  if (method === "POST" && route === "/admin/points") {
    return { ...currentActor, action: "points_updated", entityType: "points", summary: "Updated the event points configuration" };
  }
  if (method === "POST" && route === "/admin/event") {
    return { ...currentActor, action: "event_updated", entityType: "event", entityId: String(q.body?.id || ""), summary: `Updated event ${String(q.body?.id || q.body?.name || "")}` };
  }
  if ((method === "DELETE" || method === "POST") && route.startsWith("/admin/event/")) {
    return { ...currentActor, action: "event_deleted", entityType: "event", entityId: String(q.params?.id || ""), summary: `Deleted event ${String(q.params?.id || "")}` };
  }
  if (method === "POST" && route === "/admin/reset-events") {
    return { ...currentActor, action: "events_reset", entityType: "events", summary: q.body?.clearRegistrations ? "Reset events and cleared registrations and results" : "Reset events to Sportsitem.txt" };
  }
  if (method === "POST" && route === "/admin/db/import") {
    return { ...currentActor, action: "database_imported", entityType: "database", summary: "Imported a database snapshot" };
  }
  if (method === "POST" && route.startsWith("/publish/")) {
    return { ...currentActor, action: "results_published", entityType: "event", entityId: route.slice("/publish/".length), summary: "Published event results" };
  }
  if (method === "POST" && route.startsWith("/unpublish/")) {
    return { ...currentActor, action: "results_unpublished", entityType: "event", entityId: route.slice("/unpublish/".length), summary: "Unpublished event results" };
  }
  if (method === "GET" && ["/admin/db/export", "/admin/db/export-sql", "/export.csv"].includes(route)) {
    return { ...currentActor, action: "data_exported", entityType: "database", summary: `Downloaded ${route.split("/").pop()} export` };
  }
  return null;
}

function getCaptain(q) {
  const username = String(q.get("x-captain") || "").trim().toLowerCase();
  const password = String(q.get("x-pin") || "");
  return (db.config.captains || []).find((captain) =>
    captain.username === username &&
    (captain.passwordHash
      ? verifyCaptainPassword(password, captain.passwordHash)
      : constantTimeEqual(captain.password, password))
  );
}

function getMediaSession(q) {
  const authorization = q.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : q.get("x-media-session");
  const session = mediaSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) mediaSessions.delete(token);
    return false;
  }
  return session;
}

function requireCloudinary(s) {
  if (cloudinaryConfigured) return true;
  s.status(503).json({ error: "Cloudinary is not configured on the server" });
  return false;
}

async function uploadImageData(dataUrl, folder) {
  if (!cloudinaryConfigured) throw new Error("Cloudinary is not configured on the server");
  if (!isImageDataUrl(dataUrl)) throw new Error("Choose a valid image file");
  if (dataUrl.length > 3_500_000) throw new Error("Choose an image smaller than 2.5 MB");
  const uploaded = await cloudinary.uploader.upload(dataUrl, {
    folder,
    asset_folder: folder,
    resource_type: "image",
    unique_filename: true,
    overwrite: false,
  });
  return {
    secureUrl: uploaded.secure_url,
    publicId: uploaded.public_id,
    width: uploaded.width,
    height: uploaded.height,
    format: uploaded.format,
    bytes: uploaded.bytes,
    uploadedAt: uploaded.created_at || new Date().toISOString(),
  };
}

async function getRegistrationPhoto(q, existing) {
  const requested = String(q.body?.picture || "");
  const previous = existing.find((row) => row.picture);
  const source = requested || previous?.picture || "";
  if (!source) throw new Error("Participant picture is required");

  if (isImageDataUrl(source)) {
    const uploaded = await uploadImageData(source, CLOUDINARY_REGISTRATION_FOLDER);
    existing.forEach((row) => {
      row.picture = uploaded.secureUrl;
      row.picturePublicId = uploaded.publicId;
    });
    return { picture: uploaded.secureUrl, picturePublicId: uploaded.publicId };
  }

  if (source === previous?.picture && /^https:\/\/res\.cloudinary\.com\//i.test(source)) {
    return { picture: source, picturePublicId: previous.picturePublicId || "" };
  }

  throw new Error("Participant picture must be uploaded as an image");
}

function getRegistrationsToDelete(ids, house) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100) {
    throw new Error("Select between 1 and 100 registrations");
  }
  const requestedIds = ids.map((id) => String(id || ""));
  if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !id)) {
    throw new Error("Registration selection contains duplicate or invalid entries");
  }
  const requested = new Set(requestedIds);
  const registrations = db.regs.filter((registration) => requested.has(String(registration.id)));
  if (registrations.length !== requestedIds.length) throw new Error("One or more registrations no longer exist");
  if (house && registrations.some((registration) => norm(registration.house) !== norm(house))) {
    throw new Error("You can only remove registrations belonging to your house");
  }
  if (registrations.some((registration) => db.results[registration.eventId])) {
    throw new Error("Unpublish the affected event before removing its registrations");
  }
  return registrations;
}

async function removeRegistrations(registrations) {
  const ids = new Set(registrations.map((registration) => String(registration.id)));
  const eventIds = new Set(registrations.map((registration) => registration.eventId));
  const picturePublicIds = new Set(
    registrations.map((registration) => registration.picturePublicId).filter(Boolean)
  );
  db.regs = db.regs.filter((registration) => !ids.has(String(registration.id)));
  eventIds.forEach((eventId) => delete db.judgeSubmissions[eventId]);
  await save();

  const warnings = [];
  const orphanedPictures = [...picturePublicIds].filter(
    (publicId) => !db.regs.some((registration) => registration.picturePublicId === publicId)
  );
  if (orphanedPictures.length && !cloudinaryConfigured) {
    warnings.push("Cloudinary is not configured; participant images could not be deleted");
  } else {
    for (let offset = 0; offset < orphanedPictures.length; offset += 5) {
      const results = await Promise.all(orphanedPictures.slice(offset, offset + 5).map(async (publicId) => {
        try {
          const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
          return result.result === "ok" || result.result === "not found" ? null : "A participant image could not be deleted from Cloudinary";
        } catch {
          return "A participant image could not be deleted from Cloudinary";
        }
      }));
      warnings.push(...results.filter(Boolean));
    }
  }
  return { ok: true, removed: registrations.length, warnings };
}

const who = (id) => {
  const r = db.regs.find((x) => norm(x.reg) === norm(id));
  if (r) return { id, name: r.name, house: r.house, picture: r.picture || "" };
  const house = (db.config.houses || []).find((item) => norm(item) === norm(id));
  return house ? { id: house, name: `${house} Team`, house } : { id, name: id, house: id };
};

function getEventPoints(eventOrId) {
  const ev = typeof eventOrId === "string" ? db.events.find((e) => e.id === eventOrId) : eventOrId;
  if (ev && Array.isArray(ev.points) && ev.points.length > 0) return ev.points;
  if (ev && ev.category && db.config.categoryPoints?.[ev.category]) return db.config.categoryPoints[ev.category];
  return db.config.defaultPoints || [5, 3, 1];
}

const matchGender = (eventGender, studentGender) => {
  if (!eventGender || eventGender === "Mixed") return true;
  const eg = String(eventGender).toLowerCase();
  const sg = String(studentGender || "").toLowerCase();
  if (eg === sg) return true;
  if ((eg === "boys" || eg === "men") && (sg === "boys" || sg === "men")) return true;
  if ((eg === "girls" || eg === "women") && (sg === "girls" || sg === "women")) return true;
  return false;
};

const isRelayEvent = (event) => /relay/i.test(`${event.id} ${event.name}`);

function validateRegistrationRequest({ reg, name, house, gender, eventIds }, registrations = db.regs) {
  const id = norm(reg);
  const studentName = String(name || "").trim();
  const team = String(house || "").trim();
  const division = String(gender || "").trim();
  if (!id || !studentName) return { error: "Register number and full name are required" };
  if (!["Boys", "Girls"].includes(division)) return { error: "Select Boys or Girls division" };
  if (!(db.config.houses || []).includes(team)) return { error: "Select a valid house" };
  if (!Array.isArray(eventIds) || eventIds.length === 0) return { error: "Choose at least one event" };

  const selectedIds = eventIds.map((eventId) => String(eventId || "").trim());
  if (selectedIds.some((eventId) => !eventId) || new Set(selectedIds).size !== selectedIds.length) {
    return { error: "Remove duplicate or invalid event selections" };
  }

  const existing = registrations.filter((registration) => norm(registration.reg) === id);
  if (existing.some((registration) =>
    String(registration.name || "").trim().toLowerCase() !== studentName.toLowerCase() ||
    registration.house !== team ||
    registration.gender !== division
  )) {
    return { error: "Register number already belongs to a different participant" };
  }
  const existingEventIds = new Set(existing.map((registration) => registration.eventId));
  if (selectedIds.some((eventId) => existingEventIds.has(eventId))) {
    return { error: "Participant is already registered for a selected event" };
  }

  const selectedEvents = selectedIds.map((eventId) => db.events.find((event) => event.id === eventId));
  if (selectedEvents.some((event) => !event || !matchGender(event.gender, division))) {
    return { error: "Choose valid events for the selected division" };
  }
  if (selectedEvents.some((event) => event.registrationOpen === false)) {
    return { error: "Registration is closed for one or more selected events" };
  }
  if (selectedIds.some((eventId) => db.results[eventId])) {
    return { error: "An event is already published; ask an admin to unpublish it before changing registrations" };
  }

  const athleticsEvents = db.events.filter((event) => event.category === "Athletics");
  const athleticsIds = new Set([...existingEventIds, ...selectedIds].filter((eventId) => {
    const event = athleticsEvents.find((item) => item.id === eventId);
    return event && !isRelayEvent(event);
  }));
  const addingAthletics = selectedEvents.some((event) => event?.category === "Athletics");
  if (addingAthletics && athleticsIds.size > 3) {
    return { error: "A participant may enter up to 3 Athletics events, plus one relay" };
  }
  const relayCount = new Set([...existingEventIds, ...selectedIds].filter((eventId) => {
    const event = athleticsEvents.find((item) => item.id === eventId);
    return event && isRelayEvent(event);
  })).size;
  if (addingAthletics && relayCount > 1) return { error: "A participant may enter only one relay" };

  for (const event of selectedEvents) {
    if (!event || event.category !== "Athletics") continue;
    const entrants = new Set(
      registrations
        .filter((registration) => registration.eventId === event.id && registration.house === team)
        .map((registration) => norm(registration.reg))
    );
    if (entrants.size >= (isRelayEvent(event) ? 4 : 3)) {
      return { error: `${team} has reached the participant limit for ${event.name}` };
    }
  }

  return { error: null, id, name: studentName, house: team, gender: division, eventIds: selectedIds };
}

let registrationQueue = Promise.resolve();

async function serializeRegistration(operation) {
  const previous = registrationQueue;
  let release;
  registrationQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function addRegistration(q, s, assignedHouse) {
  return serializeRegistration(async () => {
    const registration = validateRegistrationRequest({
      ...(q.body || {}),
      ...(assignedHouse ? { house: assignedHouse } : {}),
    });
    if (registration.error) return bad(s, registration.error);
    const existing = db.regs.filter((row) => norm(row.reg) === registration.id);
    if (!requireCloudinary(s)) return;
    let photo;
    try {
      photo = await getRegistrationPhoto(q, existing);
    } catch (error) {
      return bad(s, error.message || "Participant picture upload failed");
    }

    const registeredAt = new Date().toISOString();
    for (const eventId of registration.eventIds) {
      delete db.judgeSubmissions[eventId];
      db.regs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        reg: registration.id,
        name: registration.name,
        house: registration.house,
        gender: registration.gender,
        eventId,
        picture: photo.picture,
        picturePublicId: photo.picturePublicId,
        registeredAt,
      });
    }
    await save();
    s.json({ ok: true, added: registration.eventIds.length });
  });
}

function prepareBulkRegistrations(rows, assignedHouse, requirePictures, photoOwner) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) {
    return { errors: [{ row: 0, message: "Upload between 1 and 100 participants per batch" }], registrations: [], needsPhoto: [] };
  }

  const simulatedRegistrations = [...db.regs];
  const registrations = [];
  const errors = [];
  const needsPhoto = [];
  const seenRegisterNumbers = new Set();
  rows.forEach((row, index) => {
    const rowNumber = Math.max(1, Number(row?.rowNumber) || index + 2);
    const house = assignedHouse || String(row?.house || "").trim();
    const validation = validateRegistrationRequest({
      reg: row?.reg,
      name: row?.name,
      house,
      gender: row?.gender,
      eventIds: row?.eventIds,
    }, simulatedRegistrations);
    const reg = norm(row?.reg);
    if (reg && seenRegisterNumbers.has(reg)) {
      errors.push({ row: rowNumber, reg, message: "Use one spreadsheet row per participant" });
      return;
    }
    if (reg) seenRegisterNumbers.add(reg);
    if (validation.error) {
      errors.push({ row: rowNumber, reg, message: validation.error });
      return;
    }

    const existing = simulatedRegistrations.filter((registration) => norm(registration.reg) === validation.id);
    let picture = String(row?.picture || "");
    let picturePublicId = String(row?.picturePublicId || "");
    if (picture) {
      if (!/^https:\/\/res\.cloudinary\.com\//i.test(picture) ||
          !picturePublicId.startsWith(`${CLOUDINARY_REGISTRATION_FOLDER}/`) ||
          pendingRegistrationPhotos.get(picturePublicId) !== photoOwner) {
        errors.push({ row: rowNumber, reg, message: "Photo must be uploaded to the participant registration folder" });
        return;
      }
    } else {
      picture = existing.find((registration) => registration.picture)?.picture || "";
      picturePublicId = existing.find((registration) => registration.picture)?.picturePublicId || "";
    }
    if (!picture && requirePictures) {
      errors.push({ row: rowNumber, reg, message: "Participant photo is required" });
      return;
    }
    if (!picture) needsPhoto.push(reg);

    const staged = { ...validation, picture, picturePublicId, rowNumber };
    registrations.push(staged);
    validation.eventIds.forEach((eventId, eventIndex) => {
      simulatedRegistrations.push({
        id: `bulk-validation-${index}-${eventIndex}`,
        reg: validation.id,
        name: validation.name,
        house: validation.house,
        gender: validation.gender,
        eventId,
        picture,
        picturePublicId,
      });
    });
  });
  return { errors, registrations, needsPhoto };
}

async function cleanupUnattachedRegistrationPhotos(publicIds, photoOwner) {
  const requested = [...new Set((Array.isArray(publicIds) ? publicIds : []).map(String))]
    .filter((id) =>
      id.startsWith(`${CLOUDINARY_REGISTRATION_FOLDER}/`) &&
      pendingRegistrationPhotos.get(id) === photoOwner
    );
  const orphaned = requested.filter((id) =>
    !db.regs.some((registration) => registration.picturePublicId === id)
  );
  const warnings = [];
  if (!orphaned.length) return warnings;
  if (!cloudinaryConfigured) return ["Cloudinary is not configured; uploaded participant photos could not be removed"];
  for (let offset = 0; offset < orphaned.length; offset += 5) {
    const results = await Promise.all(orphaned.slice(offset, offset + 5).map(async (publicId) => {
      try {
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
        if (result.result === "ok" || result.result === "not found") {
          pendingRegistrationPhotos.delete(publicId);
          return null;
        }
        return "An uploaded participant photo could not be removed from Cloudinary";
      } catch {
        return "An uploaded participant photo could not be removed from Cloudinary";
      }
    }));
    warnings.push(...results.filter(Boolean));
  }
  return warnings;
}

function formatBulkRegistrationErrors(errors) {
  const details = errors.slice(0, 20).map((error) =>
    error.row ? `Row ${error.row}${error.reg ? ` (${error.reg})` : ""}: ${error.message}` : error.message
  );
  if (errors.length > details.length) details.push(`${errors.length - details.length} additional row error(s)`);
  return details.join("; ");
}

function validateBulkRegistrationRequest(q, s, assignedHouse, photoOwner) {
  const prepared = prepareBulkRegistrations(q.body?.rows, assignedHouse, false, photoOwner);
  if (prepared.errors.length) {
    return s.status(400).json({ error: formatBulkRegistrationErrors(prepared.errors), errors: prepared.errors });
  }
  s.json({ ok: true, needsPhoto: prepared.needsPhoto });
}

async function commitBulkRegistrationRequest(q, s, assignedHouse, photoOwner) {
  return serializeRegistration(async () => {
    const rows = q.body?.rows;
    const prepared = prepareBulkRegistrations(rows, assignedHouse, true, photoOwner);
    if (prepared.errors.length) {
      const cleanupWarnings = await cleanupUnattachedRegistrationPhotos(
        (Array.isArray(rows) ? rows : []).map((row) => row?.picturePublicId),
        photoOwner
      );
      return s.status(400).json({
        error: formatBulkRegistrationErrors(prepared.errors),
        errors: prepared.errors,
        warnings: cleanupWarnings,
      });
    }

    const registeredAt = new Date().toISOString();
    const affectedEvents = new Set();
    let added = 0;
    for (const registration of prepared.registrations) {
      for (const eventId of registration.eventIds) {
        affectedEvents.add(eventId);
        delete db.judgeSubmissions[eventId];
        db.regs.push({
          id: randomUUID(),
          reg: registration.id,
          name: registration.name,
          house: registration.house,
          gender: registration.gender,
          eventId,
          picture: registration.picture,
          picturePublicId: registration.picturePublicId,
          registeredAt,
        });
        added += 1;
      }
    }
    try {
      await save();
    } catch (error) {
      console.error("Bulk registration persistence failed:", error.message);
      const cleanupWarnings = await cleanupUnattachedRegistrationPhotos(
        prepared.registrations.map((registration) => registration.picturePublicId),
        photoOwner
      );
      return s.status(503).json({
        error: "Bulk registration could not be saved. Refresh the registration list before retrying.",
        warnings: cleanupWarnings,
      });
    }
    prepared.registrations.forEach((registration) => {
      if (registration.picturePublicId) pendingRegistrationPhotos.delete(registration.picturePublicId);
    });
    s.json({ ok: true, participants: prepared.registrations.length, added, affectedEvents: affectedEvents.size });
  });
}

function state() {
  const houses = db.config.houses || defaultHouses;
  const st = Object.fromEntries(houses.map((h) => [h, { house: h, gold: 0, silver: 0, bronze: 0, points: 0 }]));

  const results = {};
  for (const [eid, r] of Object.entries(db.results)) {
    const event = db.events.find((item) => item.id === eid);
    const teamEvent = event?.category === "Games" || /relay/i.test(`${event?.id || ""} ${event?.name || ""}`);
    const placesWithDetails = r.places.map((id) => {
      const person = who(id);
      if (!teamEvent || person.picture) return person;
      const representative = db.regs.find(
        (registration) =>
          registration.eventId === eid &&
          norm(registration.house) === norm(person.house) &&
          registration.picture
      );
      return { ...person, picture: representative?.picture || "" };
    });
    results[eid] = { at: r.at, places: placesWithDetails };
    const evPoints = getEventPoints(eid);

    r.places.forEach((id, i) => {
      const person = who(id);
      let h = st[person.house];
      if (!h) {
        // Handle unlisted or custom house gracefully
        st[person.house] = { house: person.house, gold: 0, silver: 0, bronze: 0, points: 0 };
        h = st[person.house];
      }
      h.points += Number(evPoints[i] || 0);
      const medal = ["gold", "silver", "bronze"][i];
      if (medal) h[medal]++;
    });
  }

  const standings = Object.values(st).sort((a, b) => b.points - a.points || b.gold - a.gold);
  const counts = {};
  db.regs.forEach((r) => (counts[r.eventId] = (counts[r.eventId] || 0) + 1));
  return { standings, results, counts, published: Object.keys(results).length };
}

function getJudgeEntries(eventId) {
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw new Error("Event not found");
  const registered = db.regs.filter((registration) => registration.eventId === eventId);
  if (event.category === "Games" || isRelayEvent(event)) {
    const teams = new Map();
    for (const registration of registered) {
      if (!teams.has(registration.house)) {
        teams.set(registration.house, {
          reg: registration.house,
          name: `${registration.house} Team`,
          house: registration.house,
          members: 0,
        });
      }
      teams.get(registration.house).members++;
    }
    if (teams.size === 0) {
      for (const house of db.config.houses || defaultHouses) {
        teams.set(house, { reg: house, name: `${house} Team`, house, members: 0 });
      }
    }
    return [...teams.values()];
  }
  const participants = new Map();
  for (const registration of registered) {
    const id = norm(registration.reg);
    if (!participants.has(id)) {
      participants.set(id, {
        reg: id,
        name: registration.name,
        house: registration.house,
      });
    }
  }
  return [...participants.values()];
}

// SQL Migration generator for PostgreSQL / Supabase
export function generateMigrationSql(database) {
  const c = database.config || {};
  const events = database.events || [];
  const registrations = database.regs || [];
  const results = database.results || {};
  const scores = database.scores || [];
  const submissions = database.judgeSubmissions || {};
  const logs = Array.isArray(database.auditLogs) ? database.auditLogs : [];
  const quote = (value) => `'${String(value ?? "").replace(/'/g, "''")}'`;
  const json = (value) => `${quote(JSON.stringify(value ?? null))}::jsonb`;
  const numberArray = (values, fallback) => {
    const numbers = (Array.isArray(values) ? values : fallback).map(Number).filter(Number.isInteger);
    return `ARRAY[${numbers.length ? numbers.join(", ") : fallback.join(", ")}]`;
  };
  const configuredHouses = Array.isArray(c.houses) && c.houses.length ? c.houses : defaultHouses;
  const houses = [...new Set([...configuredHouses, ...registrations.map((row) => row.house).filter(Boolean)])];
  const maxEventsPerStudent = Math.max(1, Math.trunc(Number(c.maxEventsPerStudent) || 3));
  const students = new Map();
  for (const registration of registrations) {
    const reg = norm(registration.reg);
    const previous = students.get(reg);
    const currentTime = Date.parse(registration.registeredAt || "") || 0;
    const previousTime = Date.parse(previous?.registeredAt || "") || 0;
    if (!previous || currentTime >= previousTime) {
      students.set(reg, {
        reg,
        name: registration.name,
        house: registration.house,
        gender: registration.gender,
        picture: registration.picture,
        picturePublicId: registration.picturePublicId,
        registeredAt: registration.registeredAt,
      });
    }
  }

  let sql = `-- DCAS Sports Meet Supabase schema and data migration
-- Generated: ${new Date().toISOString()}
-- This export includes participant and activity records; store and share it securely.
-- Captain rows are omitted because the legacy JSON stores plaintext passwords.

CREATE TABLE IF NOT EXISTS tournament_config (
  id text PRIMARY KEY CHECK (id = 'current'),
  name text NOT NULL,
  max_events_per_student integer NOT NULL DEFAULT 3,
  categories jsonb NOT NULL DEFAULT '["Athletics", "Games"]'::jsonb,
  genders jsonb NOT NULL DEFAULT '["Boys", "Girls"]'::jsonb,
  category_points jsonb NOT NULL DEFAULT '{"Athletics":[5,3,1],"Games":[10,6,0]}'::jsonb,
  default_points integer[] NOT NULL DEFAULT '{5,3,1}',
  live_day text NOT NULL DEFAULT 'Day 2',
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured_winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS houses (
  name text PRIMARY KEY,
  display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS captains (
  id text PRIMARY KEY,
  house_name text NOT NULL UNIQUE REFERENCES houses(name),
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Athletics', 'Games')),
  gender text NOT NULL CHECK (gender IN ('Boys', 'Girls', 'Mixed')),
  event_type text NOT NULL DEFAULT 'track',
  points integer[] NOT NULL DEFAULT '{5,3,1}',
  registration_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_open boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS students (
  reg_no text PRIMARY KEY,
  full_name text NOT NULL,
  house_name text NOT NULL REFERENCES houses(name),
  gender text NOT NULL CHECK (gender IN ('Boys', 'Girls')),
  picture_url text,
  picture_public_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registrations (
  id text PRIMARY KEY,
  reg_no text NOT NULL REFERENCES students(reg_no) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reg_no, event_id)
);

CREATE TABLE IF NOT EXISTS results (
  event_id text PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  places text[] NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS judge_submissions (
  event_id text PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  judge_name text NOT NULL,
  positions jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legacy_scores (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reg_no text NOT NULL,
  judge_name text NOT NULL,
  score numeric(5,2) NOT NULL,
  scored_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gallery_photos (
  id text PRIMARY KEY,
  caption text NOT NULL DEFAULT '',
  secure_url text NOT NULL,
  public_id text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  width integer,
  height integer,
  format text,
  bytes bigint
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL,
  actor_id text NOT NULL DEFAULT '',
  actor_name text NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  subject_reg text,
  summary text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS registrations_event_id_idx ON registrations(event_id);
CREATE INDEX IF NOT EXISTS registrations_reg_no_idx ON registrations(reg_no);
CREATE INDEX IF NOT EXISTS gallery_photos_uploaded_at_idx ON gallery_photos(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_occurred_at_idx ON audit_logs(occurred_at DESC);

ALTER TABLE tournament_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE captains ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE tournament_config, houses, captains, events, students, registrations, results,
  judge_submissions, legacy_scores, gallery_photos, audit_logs FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE tournament_config, houses, captains, events, students, registrations, results,
  judge_submissions, legacy_scores, gallery_photos, audit_logs TO service_role;

BEGIN;
INSERT INTO tournament_config
  (id, name, max_events_per_student, categories, genders, category_points, default_points, live_day, schedule, featured_winners)
VALUES
  ('current', ${quote(c.name || "DCAS Sports Meet 2026")}, ${maxEventsPerStudent},
   ${json(c.categories || ["Athletics", "Games"])}, ${json(c.genders || ["Boys", "Girls"])},
   ${json(c.categoryPoints || defaultCategoryPoints)}, ${numberArray(c.defaultPoints, defaultPoints)},
   ${quote(c.liveDay || "Day 2")}, ${json(c.schedule || [])}, ${json(c.featuredWinners || [])})
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, max_events_per_student = EXCLUDED.max_events_per_student,
  categories = EXCLUDED.categories, genders = EXCLUDED.genders, category_points = EXCLUDED.category_points,
  default_points = EXCLUDED.default_points, live_day = EXCLUDED.live_day, schedule = EXCLUDED.schedule,
  featured_winners = EXCLUDED.featured_winners, updated_at = now();
`;

  houses.forEach((house, index) => {
    sql += `\nINSERT INTO houses (name, display_order) VALUES (${quote(house)}, ${index}) ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order;`;
  });
  events.forEach((event) => {
    sql += `\nINSERT INTO events (id, name, category, gender, event_type, points, registration_open) VALUES (${quote(event.id)}, ${quote(event.name)}, ${quote(event.category)}, ${quote(event.gender)}, ${quote(event.type || "track")}, ${numberArray(event.points, defaultPoints)}, ${event.registrationOpen !== false}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, gender = EXCLUDED.gender, event_type = EXCLUDED.event_type, points = EXCLUDED.points, registration_open = EXCLUDED.registration_open;`;
  });
  for (const student of students.values()) {
    const pictureUrl = /^https?:\/\//i.test(String(student.picture || "")) ? student.picture : null;
    const picturePublicId = pictureUrl ? student.picturePublicId || null : null;
    const createdAt = student.registeredAt || new Date().toISOString();
    sql += `\nINSERT INTO students (reg_no, full_name, house_name, gender, picture_url, picture_public_id, created_at, updated_at) VALUES (${quote(student.reg)}, ${quote(student.name)}, ${quote(student.house)}, ${quote(student.gender)}, ${pictureUrl ? quote(pictureUrl) : "NULL"}, ${picturePublicId ? quote(picturePublicId) : "NULL"}, ${quote(createdAt)}, ${quote(createdAt)}) ON CONFLICT (reg_no) DO UPDATE SET full_name = EXCLUDED.full_name, house_name = EXCLUDED.house_name, gender = EXCLUDED.gender, picture_url = EXCLUDED.picture_url, picture_public_id = EXCLUDED.picture_public_id, updated_at = now();`;
  }
  registrations.forEach((registration) => {
    sql += `\nINSERT INTO registrations (id, reg_no, event_id, registered_at) VALUES (${quote(registration.id)}, ${quote(norm(registration.reg))}, ${quote(registration.eventId)}, ${quote(registration.registeredAt || new Date().toISOString())}) ON CONFLICT (id) DO UPDATE SET reg_no = EXCLUDED.reg_no, event_id = EXCLUDED.event_id, registered_at = EXCLUDED.registered_at;`;
  });
  for (const [eventId, result] of Object.entries(results)) {
    const places = (result.places || []).map(quote).join(", ");
    sql += `\nINSERT INTO results (event_id, places, published_at) VALUES (${quote(eventId)}, ARRAY[${places}], ${quote(result.at || new Date().toISOString())}) ON CONFLICT (event_id) DO UPDATE SET places = EXCLUDED.places, published_at = EXCLUDED.published_at;`;
  }
  for (const [eventId, submission] of Object.entries(submissions)) {
    sql += `\nINSERT INTO judge_submissions (event_id, judge_name, positions, submitted_at) VALUES (${quote(eventId)}, ${quote(JUDGE_NAME)}, ${quote(JSON.stringify(submission.positions || []))}::jsonb, ${quote(submission.submittedAt || new Date().toISOString())}) ON CONFLICT (event_id) DO UPDATE SET judge_name = EXCLUDED.judge_name, positions = EXCLUDED.positions, submitted_at = EXCLUDED.submitted_at;`;
  }
  scores.forEach((score, index) => {
    const id = String(score.id || `legacy-${index}-${score.eventId}-${score.reg}`);
    sql += `\nINSERT INTO legacy_scores (id, event_id, reg_no, judge_name, score, scored_at) VALUES (${quote(id)}, ${quote(score.eventId)}, ${quote(score.reg)}, ${quote(JUDGE_NAME)}, ${Number(score.score) || 0}, ${quote(score.scoredAt || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`;
  });
  for (const photo of c.gallery || []) {
    if (!/^https:\/\//i.test(String(photo.src || ""))) continue;
    sql += `\nINSERT INTO gallery_photos (id, caption, secure_url, public_id, uploaded_at) VALUES (${quote(photo.id || randomUUID())}, ${quote(photo.caption || "")}, ${quote(photo.src)}, ${photo.publicId ? quote(photo.publicId) : "NULL"}, ${quote(photo.uploadedAt || photo.at || new Date().toISOString())}) ON CONFLICT (id) DO UPDATE SET caption = EXCLUDED.caption, secure_url = EXCLUDED.secure_url, public_id = EXCLUDED.public_id, uploaded_at = EXCLUDED.uploaded_at;`;
  }
  for (const log of logs) {
    const id = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(log.id || "")) ? log.id : randomUUID();
    sql += `\nINSERT INTO audit_logs (id, occurred_at, actor_type, actor_id, actor_name, action, entity_type, entity_id, subject_reg, summary) VALUES (${quote(id)}::uuid, ${quote(log.at || new Date().toISOString())}, ${quote(log.type || "visitor")}, ${quote(log.actorId || "")}, ${quote(log.name || "Unknown")}, ${quote(log.action || "unknown")}, ${log.entityType ? quote(log.entityType) : "NULL"}, ${log.entityId ? quote(log.entityId) : "NULL"}, ${log.subjectReg ? quote(log.subjectReg) : "NULL"}, ${quote(log.summary || "")}) ON CONFLICT (id) DO NOTHING;`;
  }
  sql += `\nCOMMIT;\n`;
  return sql;
}

const app = express();
app.use(express.json({ limit: "4mb" }));

const authLoginAttempts = new Map();
app.use((q, s, next) => {
  if (q.path.startsWith("/api/media/") && getMediaSession(q)) {
    q.auditActor = { type: "media_team", id: "shared", name: "Media Team" };
  }
  s.on("finish", () => {
    const pointsLookupNotFound = q.method === "GET" && q.path.startsWith("/api/student/") && s.statusCode === 404;
    if ((s.statusCode < 200 || s.statusCode >= 300) && !pointsLookupNotFound) return;
    const entry = activityForRequest(q, s);
    if (entry) appendActivityLog(entry);
  });
  next();
});

app.post("/api/auth/verify", (q, s) => {
  const role = q.body?.role;
  if (role !== "admin" && role !== "judge") return bad(s, "Choose a valid login role");

  const ip = q.ip || "unknown";
  const now = Date.now();
  const attempt = authLoginAttempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) {
    return s.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
  }

  const expected = role === "admin" ? PIN.admin : PIN.judge;
  if (!expected || !constantTimeEqual(q.body?.pin, expected)) {
    const activeAttempt = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + 15 * 60 * 1000 };
    activeAttempt.count += 1;
    authLoginAttempts.set(ip, activeAttempt);
    return s.status(401).json({ error: "Wrong PIN" });
  }

  authLoginAttempts.delete(ip);
  q.auditActor = {
    type: role,
    id: role,
    name: role === "admin" ? ADMIN_NAME : JUDGE_NAME,
  };
  s.json({ ok: true, role, name: q.auditActor.name });
});

// Public config & live state
app.get("/api/config", (_q, s) =>
  s.json({
    name: db.config.name,
    houses: db.config.houses,
    maxEventsPerStudent: db.config.maxEventsPerStudent || 3,
    categories: db.config.categories || ["Athletics", "Games"],
    genders: db.config.genders || ["Boys", "Girls"],
    categoryPoints: db.config.categoryPoints || defaultCategoryPoints,
    defaultPoints: db.config.defaultPoints || defaultPoints,
    events: db.events,
    gallery: db.config.gallery || [],
    liveDay: db.config.liveDay || "Day 2",
    schedule: db.config.schedule || [],
    featuredWinners: (db.config.featuredWinners || []).map((winner) => ({
      ...winner,
      picture: db.regs.find((registration) => norm(registration.reg) === norm(winner.participantReg))?.picture || "",
    })),
  })
);

app.get("/api/gallery", (_q, s) => {
  const photos = [...(db.config.gallery || [])]
    .sort((a, b) => (Date.parse(b.uploadedAt || b.at || "") || 0) - (Date.parse(a.uploadedAt || a.at || "") || 0))
    .map(({ id, src, caption, at, uploadedAt }) => ({ id, src, caption, at, uploadedAt }));
  s.json({ photos });
});

app.post("/api/activity/gallery/:id", (q, s) => {
  const photo = (db.config.gallery || []).find((item) => item.id === q.params.id);
  if (!photo) return s.status(404).json({ error: "Gallery photo not found" });
  if (!["open", "download_click"].includes(q.body?.action)) return bad(s, "Choose a valid gallery action");
  q.auditActor = { type: "gallery_visitor", id: "anonymous", name: "Gallery visitor" };
  s.json({ ok: true });
});

app.get("/api/admin/activity-log", auth("admin"), (q, s) => {
  const limit = Math.min(500, Math.max(1, Number(q.query.limit) || 100));
  const offset = Math.max(0, Number(q.query.offset) || 0);
  const type = String(q.query.type || "");
  const filtered = type ? db.auditLogs.filter((entry) => entry.type === type) : db.auditLogs;
  s.json({ entries: filtered.slice(offset, offset + limit), total: filtered.length });
});

app.get("/api/state", (_q, s) => s.json(state()));

// Student registration
app.post("/api/register", (q, s) => {
  return bad(s, "Registration is available only through an authorized house captain");
});

app.post("/api/captain/login", (q, s) => {
  const { username, password } = q.body || {};
  const captain = (db.config.captains || []).find(
    (c) => c.username === String(username || "").trim().toLowerCase() &&
      (c.passwordHash
        ? verifyCaptainPassword(password, c.passwordHash)
        : constantTimeEqual(c.password, password))
  );
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  q.auditActor = {
    type: "captain",
    id: captain.username,
    name: `${captain.name || captain.username} · ${captain.house}`,
  };
  s.json({ ok: true, house: captain.house, username: captain.username, name: captain.name || captain.username });
});

app.get("/api/captain/registrations", (q, s) => {
  const captain = getCaptain(q);
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  s.json(db.regs.filter((registration) => norm(registration.house) === norm(captain.house)));
});

app.post("/api/captain/register", async (q, s) => {
  const captain = getCaptain(q);
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  return addRegistration(q, s, captain.house);
});

// Student points & status lookup
app.get("/api/student/:reg", (q, s) => {
  const id = norm(q.params.reg);
  const regs = db.regs.filter((r) => norm(r.reg) === id);
  if (!regs.length) return s.status(404).json({ error: "Register number not found" });

  const rows = regs.map((r) => {
    const res = db.results[r.eventId];
    const ev = db.events.find((x) => x.id === r.eventId);
    const resultId = ev && (ev.category === "Games" || isRelayEvent(ev)) ? norm(r.house) : id;
    const i = res ? res.places.indexOf(resultId) : -1;
    const evPoints = getEventPoints(r.eventId);
    return {
      eventId: r.eventId,
      eventName: ev?.name || r.eventId,
      category: ev?.category || "General",
      gender: ev?.gender || r.gender,
      status: !res ? "Pending" : i < 0 ? "Participated" : ["1st Place 🥇", "2nd Place 🥈", "3rd Place 🥉"][i] || "Placed",
      points: i >= 0 ? Number(evPoints[i] || 0) : 0,
    };
  });

  s.json({
    reg: id,
    name: regs[0].name,
    house: regs[0].house,
    gender: regs[0].gender,
    rows,
    total: rows.reduce((a, r) => a + r.points, 0),
  });
});

// Judge views and ranked submissions
app.get("/api/entries/:eid", auth("judge"), (q, s) => {
  const entries = getJudgeEntries(q.params.eid);
  const submission = db.judgeSubmissions[q.params.eid] || null;
  const positions = new Map((submission?.positions || []).map((item) => [item.reg, item.position]));
  s.json({
    entries: entries.map((entry) => ({ ...entry, position: positions.get(entry.reg) || "" })),
    submission,
    published: Boolean(db.results[q.params.eid]),
  });
});

app.post("/api/judge/submit/:eid", auth("judge"), async (q, s) => {
  const eventId = q.params.eid;
  if (db.results[eventId]) return bad(s, "This event is already published; ask an admin to unpublish it before resubmitting");
  const event = db.events.find((item) => item.id === eventId);
  if (!event) return bad(s, "Event not found");
  const isGamesEvent = event.category === "Games";
  const entries = getJudgeEntries(eventId);
  if (!entries.length) return bad(s, "No registered participants or teams are available to rank");
  const positions = q.body?.positions;
  if (!Array.isArray(positions) || (isGamesEvent ? positions.length < 2 || positions.length > Math.min(4, entries.length) : positions.length !== entries.length)) {
    return bad(s, "Assign a position to every participant or team before submitting");
  }

  const allowed = new Set(entries.map((entry) => entry.reg));
  const regs = positions.map((item) => String(item?.reg || "").trim());
  const ranks = positions.map((item) => Number(item?.position));
  const sequentialGameRanks = [...ranks].sort((a, b) => a - b).every((rank, index) => rank === index + 1);
  if (
    regs.some((reg) => !allowed.has(reg)) ||
    new Set(regs).size !== positions.length ||
    ranks.some((rank) => !Number.isInteger(rank) || rank < 1 || rank > (isGamesEvent ? Math.min(4, entries.length) : entries.length)) ||
    new Set(ranks).size !== positions.length ||
    (isGamesEvent && (!ranks.includes(1) || !ranks.includes(2) || !sequentialGameRanks))
  ) {
    return bad(s, isGamesEvent
      ? "Games results require unique 1st and 2nd; optional 3rd and 4th places must be consecutive"
      : "Positions must rank every listed entry once, from 1 to the number of participants");
  }

  db.judgeSubmissions[eventId] = {
    judge: JUDGE_NAME,
    submittedAt: new Date().toISOString(),
    positions: positions
      .map((item) => ({ reg: String(item.reg), position: Number(item.position) }))
      .sort((a, b) => a.position - b.position),
  };
  await save();
  s.json({ ok: true, submission: db.judgeSubmissions[eventId] });
});

app.post("/api/score", auth("judge"), async (q, s) => {
  const { eventId, reg, score } = q.body;
  const judge = JUDGE_NAME;
  const n = Number(score);
  if (!(n >= 0 && n <= 100)) return bad(s, "Score must be 0 to 100");
  const row = db.scores.find((x) => x.eventId === eventId && x.reg === reg && x.judge === judge);
  row ? (row.score = n) : db.scores.push({ eventId, reg, judge, score: n });
  await save();
  s.json({ ok: true });
});

// =================== ADMIN MANAGEMENT ===================

// Update Team / House Names
app.post("/api/admin/teams", auth("admin"), async (q, s) => {
  const { houses } = q.body;
  if (!Array.isArray(houses) || !houses.length) return bad(s, "Must provide at least one team");
  const cleaned = houses.map((h) => String(h || "").trim()).filter(Boolean);
  if (!cleaned.length) return bad(s, "Team names cannot be empty");
  db.config.houses = [...new Set(cleaned)];
  await save();
  s.json({ ok: true, houses: db.config.houses });
});

app.get("/api/admin/captains", auth("admin"), (_q, s) => {
  s.json({
    captains: (db.config.captains || []).map(({ password, ...captain }) => ({
      ...Object.fromEntries(Object.entries(captain).filter(([key]) => key !== "passwordHash")),
      password: password || "",
    })),
  });
});

app.get("/api/admin/judge-submissions", auth("admin"), (_q, s) => {
  s.json(db.judgeSubmissions || {});
});

app.post("/api/admin/site-content", auth("admin"), async (q, s) => {
  const { liveDay, schedule, featuredWinners } = q.body || {};
  if (typeof liveDay !== "string" || !liveDay.trim()) return bad(s, "Live day is required");
  if (!Array.isArray(schedule) || !Array.isArray(featuredWinners)) return bad(s, "Schedule and featured winners must be lists");
  const cleanSchedule = schedule.map((item) => ({
    day: String(item.day || "").trim(),
    time: String(item.time || "").trim(),
    event: String(item.event || "").trim(),
    category: String(item.category || "").trim(),
    gender: String(item.gender || "").trim(),
    location: String(item.location || "").trim(),
  }));
  if (cleanSchedule.some((item) => !item.day || !item.time || !item.event || !item.location)) {
    return bad(s, "Every schedule row must include Day, Time, Event, and Location");
  }
  const cleanWinners = featuredWinners.map((winner) => ({
    id: String(winner.id || Date.now() + Math.random()),
    event: String(winner.event || "").trim(),
    category: ["Boys", "Girls", "Mixed"].includes(winner.category) ? winner.category : "Mixed",
    name: String(winner.name || "").trim(),
    house: String(winner.house || "").trim(),
    participantReg: db.regs.some((registration) => norm(registration.reg) === norm(winner.participantReg))
      ? String(winner.participantReg || "").trim().toUpperCase()
      : "",
    result: String(winner.result || "").trim(),
  }));
  if (cleanWinners.some((winner) => !winner.event || !winner.name)) {
    return bad(s, "Every featured winner must include an Event and Winner / team name");
  }
  db.config.liveDay = liveDay.trim();
  db.config.schedule = cleanSchedule;
  db.config.featuredWinners = cleanWinners;
  await save();
  s.json({
    ok: true,
    liveDay: db.config.liveDay,
    schedule: db.config.schedule,
    featuredWinners: db.config.featuredWinners,
  });
});

app.post("/api/admin/registration", auth("admin"), async (q, s) => {
  return addRegistration(q, s);
});

app.post("/api/admin/registration/bulk/validate", auth("admin"), (q, s) => {
  validateBulkRegistrationRequest(q, s, undefined, "admin:admin");
});

app.post("/api/captain/register-bulk/validate", (q, s) => {
  const captain = getCaptain(q);
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  validateBulkRegistrationRequest(q, s, captain.house, `captain:${captain.username}`);
});

app.post("/api/admin/registration/photo", auth("admin"), async (q, s) => {
  if (!requireCloudinary(s)) return;
  try {
    const uploaded = await uploadImageData(String(q.body?.picture || ""), CLOUDINARY_REGISTRATION_FOLDER);
    pendingRegistrationPhotos.set(uploaded.publicId, "admin:admin");
    s.json({ picture: uploaded.secureUrl, picturePublicId: uploaded.publicId });
  } catch (error) {
    return bad(s, error.message || "Participant picture upload failed");
  }
});

app.post("/api/captain/registration/photo", async (q, s) => {
  const captain = getCaptain(q);
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  if (!requireCloudinary(s)) return;
  try {
    const uploaded = await uploadImageData(String(q.body?.picture || ""), CLOUDINARY_REGISTRATION_FOLDER);
    pendingRegistrationPhotos.set(uploaded.publicId, `captain:${captain.username}`);
    s.json({ picture: uploaded.secureUrl, picturePublicId: uploaded.publicId });
  } catch (error) {
    return bad(s, error.message || "Participant picture upload failed");
  }
});

app.post("/api/admin/registration/bulk", auth("admin"), async (q, s) => {
  return commitBulkRegistrationRequest(q, s, undefined, "admin:admin");
});

app.post("/api/captain/register-bulk", async (q, s) => {
  const captain = getCaptain(q);
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  return commitBulkRegistrationRequest(q, s, captain.house, `captain:${captain.username}`);
});

app.delete("/api/admin/registration/photos", auth("admin"), async (q, s) => {
  const warnings = await cleanupUnattachedRegistrationPhotos(q.body?.publicIds, "admin:admin");
  s.json({ ok: true, warnings });
});

app.delete("/api/captain/registration/photos", async (q, s) => {
  const captain = getCaptain(q);
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  const warnings = await cleanupUnattachedRegistrationPhotos(q.body?.publicIds, `captain:${captain.username}`);
  s.json({ ok: true, warnings });
});

// Generate or update house-captain credentials
app.post("/api/admin/captains", auth("admin"), async (q, s) => {
  const { captains } = q.body || {};
  if (!Array.isArray(captains)) return bad(s, "Captain list is required");
  const existingByUsername = new Map((db.config.captains || []).map((captain) => [captain.username, captain]));
  const normalizedCaptains = captains.map((captain) => {
    const house = String(captain.house || "").trim();
    const username = String(captain.username || "").trim().toLowerCase();
    const password = String(captain.password || "");
    const existing = existingByUsername.get(username);
    if (!password && existing && existing.house === house) {
      return { ...existing, name: String(captain.name || "").trim() || username };
    }
    return {
      house,
      name: String(captain.name || "").trim(),
      username,
      password,
    };
  }).filter((captain) => captain.house && captain.username && (captain.password || captain.passwordHash));
  if (new Set(normalizedCaptains.map((captain) => captain.house)).size !== normalizedCaptains.length ||
      new Set(normalizedCaptains.map((captain) => captain.username)).size !== normalizedCaptains.length) {
    return bad(s, "Each house and captain username must be unique");
  }
  if (SUPABASE_MODE && normalizedCaptains.some((captain) => !captain.passwordHash && captain.password.length < 8)) {
    return bad(s, "Captain passwords must be at least 8 characters");
  }
  const responseCaptains = normalizedCaptains.map((captain) => ({
    house: captain.house,
    name: captain.name,
    username: captain.username,
    password: captain.password || "",
  }));
  db.config.captains = normalizedCaptains;
  await save();
  s.json({ ok: true, captains: responseCaptains });
});

// Gallery photos
app.post("/api/admin/gallery", auth("admin"), async (q, s) => {
  const { photo, caption } = q.body || {};
  if (!photo) return bad(s, "A photo is required");
  if (!requireCloudinary(s)) return;
  let uploaded;
  try {
    uploaded = await uploadImageData(String(photo), CLOUDINARY_GALLERY_FOLDER);
  } catch (error) {
    return bad(s, error.message || "Gallery photo upload failed");
  }
  const item = {
    id: randomUUID(),
    src: uploaded.secureUrl,
    publicId: uploaded.publicId,
    caption: String(caption || "").trim(),
    at: uploaded.uploadedAt,
    uploadedAt: uploaded.uploadedAt,
  };
  db.config.gallery = [item, ...(db.config.gallery || [])];
  await save();
  s.json({ ok: true, gallery: db.config.gallery });
});

app.delete("/api/admin/gallery/:id", auth("admin"), async (q, s) => {
  const removed = (db.config.gallery || []).find((item) => item.id === q.params.id);
  if (removed?.publicId) {
    if (!requireCloudinary(s)) return;
    try {
      const result = await cloudinary.uploader.destroy(removed.publicId, { resource_type: "image", invalidate: true });
      if (result.result !== "ok" && result.result !== "not found") {
        return bad(s, "Could not delete the Cloudinary image");
      }
    } catch (error) {
      return bad(s, error.message || "Could not delete the Cloudinary image");
    }
  }
  db.config.gallery = (db.config.gallery || []).filter((item) => item.id !== q.params.id);
  await save();
  s.json({ ok: true, gallery: db.config.gallery });
});

app.post("/api/media/login", (q, s) => {
  const expectedPassword = process.env.MEDIA_UPLOAD_PASSWORD;
  if (!expectedPassword) return s.status(503).json({ error: "Media upload password is not configured on the server" });

  const ip = q.ip || "unknown";
  const now = Date.now();
  const attempt = mediaLoginAttempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) {
    return s.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
  }
  if (!constantTimeEqual(q.body?.password, expectedPassword)) {
    const activeAttempt = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + 15 * 60 * 1000 };
    activeAttempt.count += 1;
    mediaLoginAttempts.set(ip, activeAttempt);
    return s.status(401).json({ error: "Incorrect media upload password" });
  }

  mediaLoginAttempts.delete(ip);
  const token = randomBytes(32).toString("hex");
  const expiresAt = now + MEDIA_SESSION_TTL_MS;
  mediaSessions.set(token, { expiresAt, pendingPublicIds: new Set() });
  q.auditActor = { type: "media_team", id: "shared", name: "Media Team" };
  s.json({ token, expiresAt });
});

app.post("/api/media/logout", (q, s) => {
  const authorization = q.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : q.get("x-media-session");
  if (token) mediaSessions.delete(token);
  s.json({ ok: true });
});

app.post("/api/media/signatures", (q, s) => {
  const session = getMediaSession(q);
  if (!session) return s.status(401).json({ error: "Media upload session expired. Please sign in again." });
  if (!requireCloudinary(s)) return;

  const count = Number(q.body?.count);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    return bad(s, "Choose between 1 and 20 images per upload batch");
  }

  const uploads = Array.from({ length: count }, () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = randomUUID();
    const params = {
      folder: CLOUDINARY_GALLERY_FOLDER,
      asset_folder: CLOUDINARY_GALLERY_FOLDER,
      public_id: publicId,
      timestamp,
    };
    session.pendingPublicIds.add(publicId);
    return {
      publicId,
      timestamp,
      folder: CLOUDINARY_GALLERY_FOLDER,
      assetFolder: CLOUDINARY_GALLERY_FOLDER,
      signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET),
    };
  });
  s.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    uploads,
  });
});

app.post("/api/media/complete", async (q, s) => {
  const session = getMediaSession(q);
  if (!session) return s.status(401).json({ error: "Media upload session expired. Please sign in again." });
  if (!requireCloudinary(s)) return;

  const publicIds = q.body?.publicIds;
  const caption = String(q.body?.caption || "").trim();
  if (!Array.isArray(publicIds) || publicIds.length < 1 || publicIds.length > 20) {
    return bad(s, "A valid batch of uploaded images is required");
  }
  const ids = publicIds.map((id) => String(id || ""));
  const pendingIds = ids.map((id) => {
    if (session.pendingPublicIds.has(id)) return id;
    const prefix = `${CLOUDINARY_GALLERY_FOLDER}/`;
    const basename = id.startsWith(prefix) ? id.slice(prefix.length) : "";
    return session.pendingPublicIds.has(basename) ? basename : "";
  });
  if (new Set(ids).size !== ids.length || new Set(pendingIds).size !== pendingIds.length || pendingIds.some((id) => !id)) {
    return bad(s, "One or more uploads are not part of this session");
  }

  const verified = [];
  try {
    for (const publicId of ids) {
      const asset = await cloudinary.api.resource(publicId, { resource_type: "image", type: "upload" });
      const belongsToGallery =
        asset.asset_folder === CLOUDINARY_GALLERY_FOLDER ||
        asset.folder === CLOUDINARY_GALLERY_FOLDER ||
        asset.public_id.startsWith(`${CLOUDINARY_GALLERY_FOLDER}/`);
      if (!belongsToGallery || !String(asset.secure_url || "").startsWith("https://") || asset.bytes > 20_000_000) {
        return bad(s, "A Cloudinary image is invalid, outside the gallery folder, or too large");
      }
      verified.push({
        id: randomUUID(),
        src: asset.secure_url,
        publicId: asset.public_id,
        caption,
        at: asset.created_at || new Date().toISOString(),
        uploadedAt: asset.created_at || new Date().toISOString(),
      });
    }
  } catch (error) {
    return s.status(502).json({ error: error.message || "Could not verify the Cloudinary uploads" });
  }

  db.config.gallery = [...verified.reverse(), ...(db.config.gallery || [])];
  await save();
  pendingIds.forEach((id) => session.pendingPublicIds.delete(id));
  s.json({ ok: true, added: verified.length });
});

// Update Predefined Category Points & Default Points
app.post("/api/admin/points", auth("admin"), async (q, s) => {
  const { categoryPoints, defaultPoints: newDefaultPoints } = q.body;
  if (categoryPoints && typeof categoryPoints === "object") {
    db.config.categoryPoints = {
      ...db.config.categoryPoints,
      ...categoryPoints,
    };
  }
  if (Array.isArray(newDefaultPoints) && newDefaultPoints.length) {
    db.config.defaultPoints = newDefaultPoints.map(Number);
  }
  await save();
  s.json({
    ok: true,
    categoryPoints: db.config.categoryPoints,
    defaultPoints: db.config.defaultPoints,
  });
});

// Add or Edit Event (split by Category: Athletics/Games and Gender: Boys/Girls)
app.post("/api/admin/event", auth("admin"), async (q, s) => {
  const { id, name, category, gender, type, points } = q.body;
  if (!name || !String(name).trim()) return bad(s, "Event name is required");
  const validCategory = category === "Games" ? "Games" : "Athletics";
  const validGender = String(gender).toLowerCase().includes("girl") || String(gender).toLowerCase().includes("women") ? "Girls" : "Boys";
  const standard = defaultEvents.find((e) => e.id === id) ||
    defaultEvents.find((e) =>
      e.name.toLowerCase() === String(name).trim().toLowerCase() &&
      e.category === validCategory &&
      e.gender === validGender
    );
  if (!standard) return bad(s, "Only the events listed in Sportsitem.txt can be added");

  const eventPoints =
    Array.isArray(points) && points.length >= 3
      ? points.map(Number)
      : db.config.categoryPoints?.[validCategory] || (validCategory === "Games" ? [10, 6, 0] : [5, 3, 1]);

  const existingIndex = db.events.findIndex((e) => e.id === standard.id);
  const eventId = standard.id;

  const eventObj = {
    id: eventId,
    name: standard.name,
    category: standard.category,
    gender: standard.gender,
    type: type || standard.type,
    points: eventPoints,
  };

  if (existingIndex >= 0) {
    db.events[existingIndex] = { ...db.events[existingIndex], ...eventObj };
  } else {
    db.events.push(eventObj);
  }

  await save();
  s.json({ ok: true, event: eventObj, events: db.events });
});

app.post("/api/admin/event/:id/registration", auth("admin"), async (q, s) => {
  const event = db.events.find((item) => item.id === q.params.id);
  if (!event) return s.status(404).json({ error: "Event not found" });
  if (typeof q.body?.open !== "boolean") return bad(s, "Registration status must be open or closed");
  event.registrationOpen = q.body.open;
  try {
    await save();
  } catch (error) {
    return s.status(503).json({ error: error.message || "Could not save event registration status" });
  }
  s.json({ ok: true, event });
});

// Helper for event deletion
const deleteEventHandler = async (q, s) => {
  const eid = q.params.id;
  const beforeCount = db.events.length;
  db.events = db.events.filter((e) => e.id !== eid);
  delete db.results[eid];
  delete db.judgeSubmissions[eid];
  db.scores = db.scores.filter((sc) => sc.eventId !== eid);
  db.regs = db.regs.filter((r) => r.eventId !== eid);
  await save();
  s.json({ ok: true, deletedId: eid, removed: beforeCount !== db.events.length, events: db.events });
};

// Delete an Event (supports DELETE, POST /delete, and POST fallback)
app.delete("/api/admin/event/:id", auth("admin"), deleteEventHandler);
app.post("/api/admin/event/:id/delete", auth("admin"), deleteEventHandler);
app.post("/api/admin/event/:id", auth("admin"), (q, s, next) => {
  // If empty body or action is delete, handle as deletion
  if (!q.body || Object.keys(q.body).length === 0 || q.body.action === "delete") {
    return deleteEventHandler(q, s);
  }
  next();
});

// Reset events back to initial data from Sportsitem.txt
app.post("/api/admin/reset-events", auth("admin"), async (q, s) => {
  db.events = JSON.parse(JSON.stringify(defaultEvents));
  db.config.categoryPoints = {
    Athletics: [5, 3, 1],
    Games: [10, 6, 0],
  };
  db.config.defaultPoints = [5, 3, 1];
  if (q.body?.clearRegistrations) {
    db.regs = [];
    db.scores = [];
    db.judgeSubmissions = {};
    db.results = {};
  }
  await save();
  s.json({ ok: true, events: db.events, config: db.config });
});

// Database & Migration endpoints
app.get("/api/admin/db/export", auth("admin"), (_q, s) => {
  s.type("application/json")
    .attachment(`dcas-sportsmeet-db-${Date.now()}.json`)
    .json(db);
});

app.get("/api/admin/db/export-sql", auth("admin"), (_q, s) => {
  const sql = generateMigrationSql(db);
  s.type("text/plain")
    .attachment(`dcas-sportsmeet-migration-${Date.now()}.sql`)
    .send(sql);
});

app.post("/api/admin/db/import", auth("admin"), async (q, s) => {
  const imported = q.body;
  if (!imported || typeof imported !== "object") return bad(s, "Invalid JSON database import");
  if (imported.config) db.config = { ...db.config, ...imported.config };
  if (Array.isArray(imported.events)) db.events = imported.events;
  if (Array.isArray(imported.regs)) db.regs = imported.regs;
  if (Array.isArray(imported.scores)) db.scores = imported.scores;
  if (imported.judgeSubmissions && typeof imported.judgeSubmissions === "object") {
    db.judgeSubmissions = Object.fromEntries(
      Object.entries(imported.judgeSubmissions).map(([eventId, submission]) => [
        eventId,
        submission && typeof submission === "object" ? { ...submission, judge: JUDGE_NAME } : submission,
      ])
    );
  }
  if (imported.results && typeof imported.results === "object") db.results = imported.results;
  await save();
  s.json({ ok: true, db });
});

// Publish podium places
app.post("/api/publish/:eid", auth("admin"), async (q, s) => {
  const eid = q.params.eid;
  const event = db.events.find((item) => item.id === eid);
  if (!event) return bad(s, "Event not found");
  const evPoints = getEventPoints(eid);
  let places = Array.isArray(q.body?.places) ? q.body.places.map((place) => String(place).trim()).filter(Boolean) : [];

  if (!places.length && db.judgeSubmissions[eid]) {
    places = db.judgeSubmissions[eid].positions
      .slice()
      .sort((a, b) => a.position - b.position)
      .slice(0, event.category === "Games" ? 4 : 3)
      .map((item) => item.reg);
  }
  if (!places.length) {
    const sums = {};
    db.scores
      .filter((x) => x.eventId === eid)
      .forEach((x) => (sums[x.reg] = [...(sums[x.reg] || []), x.score]));
    places = Object.entries(sums)
      .map(([r, a]) => [r, a.reduce((p, c) => p + c, 0) / a.length])
      .sort((a, b) => b[1] - a[1])
      .slice(0, evPoints.length)
      .map((x) => x[0]);
  }

  if (!places.length) return bad(s, "No judge submission or podium positions are available to publish");
  if (event.category === "Games" || isRelayEvent(event)) {
    places = places.map((place) =>
      db.regs.find((registration) => registration.eventId === eid && norm(registration.reg) === norm(place))?.house ||
      (db.config.houses || []).find((house) => norm(house) === norm(place)) ||
      ""
    );
  }
  places = places.map(norm).filter(Boolean);
  if (new Set(places).size !== places.length) return bad(s, "Each podium position must be assigned to a different participant or team");
  const validEntries = new Set(getJudgeEntries(eid).map((entry) => norm(entry.reg)));
  if (places.some((place) => !validEntries.has(norm(place)))) {
    return bad(s, "Choose registered participants or teams for the podium");
  }
  places = places.slice(0, event.category === "Games" ? 4 : 3);

  db.results[eid] = { places, at: new Date().toISOString() };
  await save();
  s.json({ ok: true, places });
});

// Undo publication
app.post("/api/unpublish/:eid", auth("admin"), async (q, s) => {
  delete db.results[q.params.eid];
  await save();
  s.json({ ok: true });
});

// Registration removal
app.post("/api/unregister/:id", auth("admin"), async (q, s) => {
  try {
    const registrations = getRegistrationsToDelete([q.params.id]);
    s.json(await removeRegistrations(registrations));
  } catch (error) {
    return bad(s, error.message);
  }
});

app.post("/api/admin/unregister-bulk", auth("admin"), async (q, s) => {
  try {
    const registrations = getRegistrationsToDelete(q.body?.ids);
    s.json(await removeRegistrations(registrations));
  } catch (error) {
    return bad(s, error.message);
  }
});

app.post("/api/captain/unregister/:id", async (q, s) => {
  const captain = getCaptain(q);
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  try {
    const registrations = getRegistrationsToDelete([q.params.id], captain.house);
    s.json(await removeRegistrations(registrations));
  } catch (error) {
    return bad(s, error.message);
  }
});

app.post("/api/captain/unregister-bulk", async (q, s) => {
  const captain = getCaptain(q);
  if (!captain) return s.status(401).json({ error: "Invalid house captain credentials" });
  try {
    const registrations = getRegistrationsToDelete(q.body?.ids, captain.house);
    s.json(await removeRegistrations(registrations));
  } catch (error) {
    return bad(s, error.message);
  }
});

// List registrations
app.get("/api/regs", auth("admin"), (_q, s) => s.json(db.regs));

// Export CSV with full details
app.get("/api/export.csv", auth("admin"), (q, s) => {
  const headers = "RegNo,Name,House,Gender,Category,EventId,EventName,RegisteredAt\n";
  const rows = db.regs
    .map((r) => {
      const ev = db.events.find((e) => e.id === r.eventId);
      return [
        r.reg,
        `"${(r.name || "").replace(/"/g, '""')}"`,
        `"${(r.house || "").replace(/"/g, '""')}"`,
        r.gender,
        ev?.category || "",
        r.eventId,
        `"${(ev?.name || "").replace(/"/g, '""')}"`,
        r.registeredAt || "",
      ].join(",");
    })
    .join("\n");

  s.type("text/csv").attachment("dcas-sportsmeet-registrations.csv").send(headers + rows);
});

// Serve frontend build if present
const dist = path.join(here, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_q, s) => s.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PORT || 3001;
if (!process.env.TEST && process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  validateStorageConfig();
  validateRequiredSecrets();
  initializeDatabase()
    .then(() => app.listen(PORT, () => console.log(`Sports Meet API running on ${STORAGE_BACKEND} storage on port ${PORT}`)))
    .catch((error) => {
      console.error(`Sports Meet API startup failed: ${error.message}`);
      process.exitCode = 1;
    });
}

export { app };
