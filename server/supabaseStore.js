import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createPayload } from "./push-to-supabase.js";

const TABLES = [
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
const KEYS = {
  tournament_config: "id",
  houses: "name",
  captains: "id",
  events: "id",
  students: "reg_no",
  registrations: "id",
  results: "event_id",
  judge_submissions: "event_id",
  legacy_scores: "id",
  gallery_photos: "id",
  audit_logs: "id",
};
const UPSERT_ORDER = [
  "houses",
  "tournament_config",
  "events",
  "captains",
  "students",
  "registrations",
  "results",
  "judge_submissions",
  "legacy_scores",
  "gallery_photos",
  "audit_logs",
];
const DELETE_ORDER = [
  "registrations",
  "results",
  "judge_submissions",
  "legacy_scores",
  "students",
  "captains",
  "events",
  "houses",
  "gallery_photos",
  "audit_logs",
  "tournament_config",
];
const PAGE_SIZE = 1000;
const CHUNK_SIZE = 250;
const N = 16384;
let lastPersistedPayload = null;

function headers(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

function endpoint(table) {
  return new URL(`/rest/v1/${table}`, process.env.SUPABASE_URL);
}

async function request(url, options = {}, table = "database") {
  const response = await fetch(url, {
    ...options,
    headers: headers(options.headers),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    let code = "";
    try { code = (await response.json()).code || ""; } catch {}
    throw new Error(`Supabase request failed for ${table} (HTTP ${response.status}${code ? `, ${code}` : ""})`);
  }
  return response;
}

async function listRows(table, select = "*") {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = endpoint(table);
    url.searchParams.set("select", select);
    const response = await request(url, {
      headers: { Range: `${offset}-${offset + PAGE_SIZE - 1}` },
    }, table);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Supabase returned invalid rows for ${table}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export function hashCaptainPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(String(password), salt, 32, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyCaptainPassword(password, encoded) {
  const [algorithm, nValue, saltHex, hashHex] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || Number(nValue) !== N ||
      !/^[0-9a-f]{32}$/i.test(saltHex || "") || !/^[0-9a-f]{64}$/i.test(hashHex || "")) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(String(password), Buffer.from(saltHex, "hex"), expected.length, {
    N: Number(nValue),
    r: 8,
    p: 1,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function loadSupabaseDatabase() {
  const [
    configRows,
    houses,
    captains,
    events,
    students,
    registrations,
    results,
    submissions,
    scores,
    gallery,
    logs,
  ] = await Promise.all(TABLES.map((table) => listRows(table)));
  const configRow = configRows.find((row) => row.id === "current");
  if (!configRow) throw new Error("Supabase has no tournament_config row; import the initial data first");
  const studentByReg = new Map(students.map((student) => [student.reg_no, student]));

  const regs = registrations.map((registration) => {
    const student = studentByReg.get(registration.reg_no);
    if (!student) throw new Error("Supabase contains a registration without its student record");
    return {
      id: registration.id,
      reg: registration.reg_no,
      name: student.full_name,
      house: student.house_name,
      gender: student.gender,
      eventId: registration.event_id,
      picture: student.picture_url || "",
      picturePublicId: student.picture_public_id || "",
      registeredAt: registration.registered_at,
    };
  });
  const resultMap = Object.fromEntries(results.map((result) => [
    result.event_id,
    { places: result.places || [], at: result.published_at },
  ]));
  const submissionMap = Object.fromEntries(submissions.map((submission) => [
    submission.event_id,
    { judge: submission.judge_name, positions: submission.positions || [], submittedAt: submission.submitted_at },
  ]));

  const database = {
    config: {
      name: configRow.name,
      houses: houses.sort((a, b) => a.display_order - b.display_order).map((house) => house.name),
      maxEventsPerStudent: configRow.max_events_per_student,
      categories: configRow.categories,
      genders: configRow.genders,
      categoryPoints: configRow.category_points,
      defaultPoints: configRow.default_points,
      captains: captains.map((captain) => ({
        id: captain.id,
        house: captain.house_name,
        username: captain.username,
        name: captain.display_name,
        passwordHash: captain.password_hash,
        createdAt: captain.created_at,
      })),
      gallery: gallery.map((photo) => ({
        id: photo.id,
        src: photo.secure_url,
        publicId: photo.public_id || "",
        caption: photo.caption || "",
        at: photo.uploaded_at,
        uploadedAt: photo.uploaded_at,
        width: photo.width,
        height: photo.height,
        format: photo.format,
        bytes: photo.bytes,
      })),
      liveDay: configRow.live_day,
      schedule: configRow.schedule || [],
      featuredWinners: configRow.featured_winners || [],
    },
    events: events.map((event) => ({
      id: event.id,
      name: event.name,
      category: event.category,
      gender: event.gender,
      type: event.event_type,
      points: event.points,
      registrationOpen: event.registration_open !== false,
    })),
    regs,
    scores: scores.map((score) => ({
      id: score.id,
      eventId: score.event_id,
      reg: score.reg_no,
      judge: score.judge_name,
      score: Number(score.score),
      scoredAt: score.scored_at,
    })),
    judgeSubmissions: submissionMap,
    results: resultMap,
    auditLogs: [...logs].sort((a, b) =>
      (Date.parse(b.occurred_at || "") || 0) - (Date.parse(a.occurred_at || "") || 0)
    ).map((log) => ({
      id: log.id,
      at: log.occurred_at,
      type: log.actor_type,
      actorId: log.actor_id,
      name: log.actor_name,
      action: log.action,
      entityType: log.entity_type || "",
      entityId: log.entity_id || "",
      subjectReg: log.subject_reg || "",
      summary: log.summary,
    })),
  };
  lastPersistedPayload = createStatePayload(database);
  return database;
}

function captainRows(database) {
  return (database.config.captains || []).map((captain) => {
    const passwordHash = captain.passwordHash ||
      (captain.password ? hashCaptainPassword(captain.password) : "");
    if (!captain.house || !captain.username || !passwordHash) {
      throw new Error("A house captain is missing a house, username, or password");
    }
    return {
      id: captain.id || captain.username,
      house_name: captain.house,
      username: captain.username,
      display_name: captain.name || captain.username,
      password_hash: passwordHash,
      created_at: captain.createdAt || new Date().toISOString(),
    };
  });
}

function createStatePayload(database) {
  const payload = createPayload(database);
  for (const student of payload.students) delete student._picture_source;
  payload.captains = captainRows(database);
  return payload;
}

function quoteFilter(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function deleteRows(table, keys) {
  for (let offset = 0; offset < keys.length; offset += CHUNK_SIZE) {
    const chunk = keys.slice(offset, offset + CHUNK_SIZE);
    const url = endpoint(table);
    url.searchParams.set(KEYS[table], `in.(${chunk.map(quoteFilter).join(",")})`);
    await request(url, { method: "DELETE", headers: { Prefer: "return=minimal" } }, table);
  }
}

async function upsertRows(table, rows) {
  if (!rows.length) return;
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const url = endpoint(table);
    url.searchParams.set("on_conflict", KEYS[table]);
    await request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(offset, offset + CHUNK_SIZE)),
    }, table);
  }
}

export async function persistSupabaseDatabase(database) {
  const payload = createStatePayload(database);
  const previous = lastPersistedPayload;

  for (const table of UPSERT_ORDER) {
    const previousRows = previous?.[table] || [];
    const previousByKey = new Map(previousRows.map((row) => [String(row[KEYS[table]]), JSON.stringify(row)]));
    const changedRows = (payload[table] || []).filter(
      (row) => previousByKey.get(String(row[KEYS[table]])) !== JSON.stringify(row)
    );
    await upsertRows(table, changedRows);
  }

  for (const table of DELETE_ORDER) {
    const desiredKeys = new Set((payload[table] || []).map((row) => String(row[KEYS[table]])));
    const stale = (previous?.[table] || [])
      .map((row) => String(row[KEYS[table]]))
      .filter((key) => !desiredKeys.has(key));
    if (stale.length) await deleteRows(table, stale);
  }
  lastPersistedPayload = payload;
}
