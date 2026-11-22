import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "sportsmeet-audit-"));
const dbPath = path.join(testDir, "db.json");
const house = "BCom Co-operation";
fs.writeFileSync(dbPath, JSON.stringify({
  config: {
    houses: [house],
    captains: [{ house, name: "Test Captain", username: "test-captain", password: "captain-test-secret" }],
    gallery: [{ id: "test-photo", src: "https://images.example.test/photo.jpg", caption: "Test photo" }],
  },
  regs: [
    { id: "registration-1", reg: "TEST001", name: "Runner One", house, gender: "Boys", eventId: "ath-100m-boys", registeredAt: "2026-01-01T00:00:00.000Z" },
    { id: "registration-2", reg: "TEST002", name: "Runner Two", house, gender: "Boys", eventId: "ath-100m-boys", registeredAt: "2026-01-01T00:00:00.000Z" },
  ],
}));

process.env.TEST = "1";
process.env.SPORTSMEET_DB_FILE = dbPath;
process.env.ADMIN_PIN = "test-admin-pin-123";
process.env.JUDGE_PIN = "test-judge-pin-123";
process.env.ADMIN_NAME = "George";
process.env.JUDGE_NAME = "Test Judge";
process.env.MEDIA_UPLOAD_PASSWORD = "test-media-password";

const { app, generateMigrationSql } = await import("./index.js");
const { hashCaptainPassword, verifyCaptainPassword } = await import("./supabaseStore.js");
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (testDir.startsWith(path.join(os.tmpdir(), "sportsmeet-audit-"))) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

async function request(endpoint, { method = "GET", pin, headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      ...(pin ? { "x-pin": pin } : {}),
      ...headers,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, data };
}

test("role identities and requested activity appear in the protected audit log", async () => {
  const unauthenticated = await request("/admin/activity-log?pin=test-admin-pin-123");
  assert.equal(unauthenticated.response.status, 401);

  const adminLogin = await request("/auth/verify", {
    method: "POST",
    body: { role: "admin", pin: process.env.ADMIN_PIN },
  });
  assert.equal(adminLogin.response.status, 200);
  assert.equal(adminLogin.data.name, "George");

  const judgeLogin = await request("/auth/verify", {
    method: "POST",
    body: { role: "judge", pin: process.env.JUDGE_PIN },
  });
  assert.equal(judgeLogin.response.status, 200);
  assert.equal(judgeLogin.data.name, "Test Judge");

  const wrongRole = await request("/entries/ath-100m-boys", { pin: process.env.ADMIN_PIN });
  assert.equal(wrongRole.response.status, 401);

  const updatedEvent = await request("/admin/event", {
    method: "POST",
    pin: process.env.ADMIN_PIN,
    body: { id: "ath-100m-boys", name: "100m", category: "Athletics", gender: "Boys", type: "track" },
  });
  assert.equal(updatedEvent.response.status, 200);

  const judgeSubmission = await request("/judge/submit/ath-100m-boys", {
    method: "POST",
    pin: process.env.JUDGE_PIN,
    headers: { "x-judge": "Spoofed Judge" },
    body: {
      positions: [
        { reg: "TEST001", position: 1 },
        { reg: "TEST002", position: 2 },
      ],
    },
  });
  assert.equal(judgeSubmission.response.status, 200);

  const submissions = await request("/admin/judge-submissions", { pin: process.env.ADMIN_PIN });
  assert.equal(submissions.data["ath-100m-boys"].judge, "Test Judge");

  const lookup = await request("/student/TEST001");
  assert.equal(lookup.response.status, 200);

  for (const action of ["open", "download_click"]) {
    const galleryEvent = await request("/activity/gallery/test-photo", {
      method: "POST",
      body: { action },
    });
    assert.equal(galleryEvent.response.status, 200);
  }

  const captainLogin = await request("/captain/login", {
    method: "POST",
    body: { username: "test-captain", password: "captain-test-secret" },
  });
  assert.equal(captainLogin.response.status, 200);

  const mediaLogin = await request("/media/login", {
    method: "POST",
    body: { password: process.env.MEDIA_UPLOAD_PASSWORD },
  });
  assert.equal(mediaLogin.response.status, 200);
  const mediaLogout = await request("/media/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${mediaLogin.data.token}` },
    body: {},
  });
  assert.equal(mediaLogout.response.status, 200);

  const activity = await request("/admin/activity-log", { pin: process.env.ADMIN_PIN });
  assert.equal(activity.response.status, 200);
  assert.equal(activity.data.total, activity.data.entries.length);
  const logs = activity.data.entries;
  const judgeActivity = await request("/admin/activity-log?type=judge&limit=1&offset=0", { pin: process.env.ADMIN_PIN });
  assert.equal(judgeActivity.data.entries.length, 1);
  assert.ok(judgeActivity.data.total > 0);
  const hasAction = (action, actorType) => logs.some((entry) => entry.action === action && entry.type === actorType);
  assert.ok(hasAction("admin_login", "admin"));
  assert.ok(hasAction("event_updated", "admin"));
  assert.ok(hasAction("judge_submission", "judge"));
  assert.ok(hasAction("student_points_lookup", "student_lookup"));
  assert.ok(hasAction("gallery_open", "gallery_visitor"));
  assert.ok(hasAction("gallery_download_click", "gallery_visitor"));
  assert.ok(hasAction("captain_login", "captain"));
  assert.ok(hasAction("media_login", "media_team"));
  assert.ok(hasAction("media_logout", "media_team"));
  assert.ok(logs.every((entry) => entry.name !== "Spoofed Judge"));
  assert.ok(logs.every((entry) => entry.id && entry.id !== entry.actorId));
  assert.ok(!JSON.stringify(logs).includes(process.env.ADMIN_PIN));
  assert.ok(!JSON.stringify(logs).includes(process.env.JUDGE_PIN));
});

test("bulk registration preflight rejects the whole batch and uses the captain's assigned house", async () => {
  const before = await request("/regs", { pin: process.env.ADMIN_PIN });
  const invalidBatch = await request("/admin/registration/bulk/validate", {
    method: "POST",
    pin: process.env.ADMIN_PIN,
    body: {
      rows: [
        { rowNumber: 2, reg: "TEST003", name: "Runner Three", house, gender: "Boys", eventIds: ["ath-100m-boys"] },
        { rowNumber: 3, reg: "TEST004", name: "Runner Four", house, gender: "Boys", eventIds: ["ath-100m-boys"] },
      ],
    },
  });
  assert.equal(invalidBatch.response.status, 400);
  assert.equal(invalidBatch.data.errors[0].row, 3);

  const after = await request("/regs", { pin: process.env.ADMIN_PIN });
  assert.equal(after.data.length, before.data.length);

  const captainValidation = await request("/captain/register-bulk/validate", {
    method: "POST",
    pin: "captain-test-secret",
    headers: { "x-captain": "test-captain" },
    body: {
      rows: [
        { rowNumber: 2, reg: "TEST003", name: "Runner Three", house: "Untrusted House", gender: "Boys", eventIds: ["ath-100m-boys"] },
      ],
    },
  });
  assert.equal(captainValidation.response.status, 200);
  assert.deepEqual(captainValidation.data.needsPhoto, ["TEST003"]);
});

test("Supabase persistence writes only tables changed since the loaded snapshot", async () => {
  const savedFetch = globalThis.fetch;
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tableRows = {
    tournament_config: [{
      id: "current",
      name: "Test Meet",
      max_events_per_student: 3,
      categories: ["Athletics", "Games"],
      genders: ["Boys", "Girls"],
      category_points: { Athletics: [5, 3, 1], Games: [10, 5, 2] },
      default_points: [5, 3, 1],
      live_day: "Day 2",
      schedule: [],
      featured_winners: [],
    }],
    houses: [{ name: house, display_order: 0 }],
    captains: [],
    events: [{
      id: "ath-100m-boys",
      name: "100m",
      category: "Athletics",
      gender: "Boys",
      event_type: "track",
      points: [5, 3, 1],
    }],
    students: [{
      reg_no: "TEST001",
      full_name: "Runner One",
      house_name: house,
      gender: "Boys",
      picture_url: "https://res.cloudinary.com/test/image/upload/runner.jpg",
      picture_public_id: "dcas-sports-meet/registrations/participants/runner",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }],
    registrations: [{
      id: "registration-1",
      reg_no: "TEST001",
      event_id: "ath-100m-boys",
      registered_at: "2026-01-01T00:00:00.000Z",
    }],
    results: [],
    judge_submissions: [],
    legacy_scores: [],
    gallery_photos: [],
    audit_logs: [],
  };
  const writes = [];
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  globalThis.fetch = async (input, options = {}) => {
    const table = new URL(String(input)).pathname.split("/").pop();
    const method = options.method || "GET";
    if (method === "GET") return new Response(JSON.stringify(tableRows[table] || []), { status: 200 });
    writes.push({ table, method });
    return new Response(null, { status: 204 });
  };

  try {
    const { loadSupabaseDatabase, persistSupabaseDatabase } = await import("./supabaseStore.js");
    const database = await loadSupabaseDatabase();
    assert.equal(database.regs[0].name, "Runner One");
    await persistSupabaseDatabase(database);
    assert.deepEqual(writes, []);
    database.config.name = "Updated Test Meet";
    await persistSupabaseDatabase(database);
    assert.deepEqual(writes.map(({ table, method }) => ({ table, method })), [
      { table: "tournament_config", method: "POST" },
    ]);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }
});

test("generated Supabase SQL enables RLS and never truncates or exports secrets", () => {
  const sql = generateMigrationSql({
    config: {
      name: "Test Meet",
      houses: [house],
      gallery: [],
      categoryPoints: { Athletics: [5, 3, 1], Games: [10, 5, 2] },
      defaultPoints: [5, 3, 1],
    },
    events: [{ id: "ath-100m-boys", name: "100m", category: "Athletics", gender: "Boys", type: "track", points: [5, 3, 1] }],
    regs: [{
      id: "registration-1",
      reg: "TEST001",
      name: "Runner One",
      house,
      gender: "Boys",
      eventId: "ath-100m-boys",
      picture: "data:image/png;base64,private-image-data",
    }],
    results: {},
    scores: [],
    judgeSubmissions: {
      "ath-100m-boys": { judge: "Spoofed Judge", positions: [], submittedAt: "2026-01-01T00:00:00.000Z" },
    },
    auditLogs: [{
      id: "00000000-0000-4000-8000-000000000001",
      at: "2026-01-01T00:00:00.000Z",
      type: "admin",
      actorId: "admin",
      name: "George",
      action: "admin_login",
      summary: "Authenticated successfully",
    }],
  });

  assert.match(sql, /ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM anon, authenticated/);
  assert.match(sql, /GRANT ALL PRIVILEGES[\s\S]*TO service_role/);
  assert.match(sql, /INSERT INTO audit_logs/);
  assert.match(sql, /Test Judge/);
  assert.doesNotMatch(sql, /TRUNCATE/i);
  assert.doesNotMatch(sql, /Spoofed Judge/);
  assert.doesNotMatch(sql, /private-image-data/);
});

test("house captain passwords are persisted as verifiable one-way hashes", () => {
  const password = "secure-captain-test-password";
  const hash = hashCaptainPassword(password);
  assert.notEqual(hash, password);
  assert.ok(verifyCaptainPassword(password, hash));
  assert.equal(verifyCaptainPassword("incorrect-password", hash), false);
});
