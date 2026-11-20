// DCAS Sports Meet API. Zero-config JSON storage; easily migratable to Supabase/PostgreSQL/Turso.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB = path.join(dataDir, "db.json");

const defaultHouses = ["Falcon", "Phoenix", "Titan", "Spartan"];
const defaultCategoryPoints = {
  Athletics: [5, 3, 1],
  Games: [10, 6, 2],
};
const defaultPoints = [5, 3, 1];

const defaultEvents = [
  // Athletics - Boys
  { id: "ath-100m-boys", name: "100m Sprint", category: "Athletics", gender: "Boys", type: "track", points: [5, 3, 1] },
  { id: "ath-200m-boys", name: "200m Sprint", category: "Athletics", gender: "Boys", type: "track", points: [5, 3, 1] },
  { id: "ath-400m-boys", name: "400m Race", category: "Athletics", gender: "Boys", type: "track", points: [5, 3, 1] },
  { id: "ath-longjump-boys", name: "Long Jump", category: "Athletics", gender: "Boys", type: "field", points: [5, 3, 1] },
  { id: "ath-shotput-boys", name: "Shot Put", category: "Athletics", gender: "Boys", type: "field", points: [5, 3, 1] },
  { id: "ath-relay-boys", name: "4x100m Relay", category: "Athletics", gender: "Boys", type: "team", points: [5, 3, 1] },

  // Athletics - Girls
  { id: "ath-100m-girls", name: "100m Sprint", category: "Athletics", gender: "Girls", type: "track", points: [5, 3, 1] },
  { id: "ath-200m-girls", name: "200m Sprint", category: "Athletics", gender: "Girls", type: "track", points: [5, 3, 1] },
  { id: "ath-longjump-girls", name: "Long Jump", category: "Athletics", gender: "Girls", type: "field", points: [5, 3, 1] },
  { id: "ath-highjump-girls", name: "High Jump", category: "Athletics", gender: "Girls", type: "field", points: [5, 3, 1] },
  { id: "ath-shotput-girls", name: "Shot Put", category: "Athletics", gender: "Girls", type: "field", points: [5, 3, 1] },
  { id: "ath-relay-girls", name: "4x100m Relay", category: "Athletics", gender: "Girls", type: "team", points: [5, 3, 1] },

  // Games - Boys
  { id: "game-football-boys", name: "Football", category: "Games", gender: "Boys", type: "team", points: [10, 6, 2] },
  { id: "game-volleyball-boys", name: "Volleyball", category: "Games", gender: "Boys", type: "team", points: [10, 6, 2] },
  { id: "game-cricket-boys", name: "Cricket", category: "Games", gender: "Boys", type: "team", points: [10, 6, 2] },
  { id: "game-tugofwar-boys", name: "Tug of War", category: "Games", gender: "Boys", type: "team", points: [10, 6, 2] },
  { id: "game-badminton-boys", name: "Badminton", category: "Games", gender: "Boys", type: "court", points: [10, 6, 2] },

  // Games - Girls
  { id: "game-throwball-girls", name: "Throwball", category: "Games", gender: "Girls", type: "team", points: [10, 6, 2] },
  { id: "game-volleyball-girls", name: "Volleyball", category: "Games", gender: "Girls", type: "team", points: [10, 6, 2] },
  { id: "game-badminton-girls", name: "Badminton", category: "Games", gender: "Girls", type: "court", points: [10, 6, 2] },
  { id: "game-tugofwar-girls", name: "Tug of War", category: "Games", gender: "Girls", type: "team", points: [10, 6, 2] },
  { id: "game-tabletennis-girls", name: "Table Tennis", category: "Games", gender: "Girls", type: "court", points: [10, 6, 2] },
];

let db = {
  config: {
    name: "DCAS Sports Meet 2026",
    houses: defaultHouses,
    maxEventsPerStudent: 3,
    categories: ["Athletics", "Games"],
    genders: ["Boys", "Girls"],
    categoryPoints: defaultCategoryPoints,
    defaultPoints: defaultPoints,
  },
  events: defaultEvents,
  regs: [],
  scores: [],
  results: {},
};

if (fs.existsSync(DB)) {
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
      },
      events: Array.isArray(disk.events) && disk.events.length > 0 ? disk.events : defaultEvents,
      regs: Array.isArray(disk.regs) ? disk.regs : [],
      scores: Array.isArray(disk.scores) ? disk.scores : [],
      results: disk.results && typeof disk.results === "object" ? disk.results : {},
    };
  } catch (err) {
    console.error("Failed to parse existing db.json, using defaults", err);
  }
}

const save = () => {
  fs.writeFileSync(DB + ".tmp", JSON.stringify(db, null, 2));
  fs.renameSync(DB + ".tmp", DB);
};

// Initial save to guarantee file exists on startup
save();

const PIN = { judge: process.env.JUDGE_PIN || "1111", admin: process.env.ADMIN_PIN || "9999" };
const auth = (role) => (q, s, n) => {
  const p = q.get("x-pin");
  p === PIN.admin || (role === "judge" && p === PIN.judge) ? n() : s.status(401).json({ error: "Wrong PIN" });
};
const bad = (s, m) => s.status(400).json({ error: m });
const norm = (v) => String(v || "").trim().toUpperCase();

const who = (id) => {
  const r = db.regs.find((x) => x.reg === id);
  return r ? { id, name: r.name, house: r.house } : { id, name: id, house: id };
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

function state() {
  const houses = db.config.houses || defaultHouses;
  const st = Object.fromEntries(houses.map((h) => [h, { house: h, gold: 0, silver: 0, bronze: 0, points: 0 }]));

  const results = {};
  for (const [eid, r] of Object.entries(db.results)) {
    const placesWithDetails = r.places.map(who);
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

const app = express();
app.use(express.json());

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
  })
);

app.get("/api/state", (_q, s) => s.json(state()));

// Student registration
app.post("/api/register", (q, s) => {
  const { reg, name, house, gender, eventIds } = q.body;
  const id = norm(reg);
  if (!id || !String(name || "").trim()) return bad(s, "Enter register number and name");
  if (!db.config.houses.includes(house)) return bad(s, "Choose a valid team / house");
  if (!Array.isArray(eventIds) || !eventIds.length) return bad(s, "Choose at least one event");

  const mine = db.regs.filter((r) => r.reg === id).map((r) => r.eventId);
  const all = [...new Set([...mine, ...eventIds])];
  const maxEvents = db.config.maxEventsPerStudent || 3;
  if (all.length > maxEvents) return bad(s, `Maximum ${maxEvents} events per student allowed`);

  for (const e of eventIds) {
    const ev = db.events.find((x) => x.id === e);
    if (!ev || !matchGender(ev.gender, gender)) {
      return bad(s, `Invalid event "${ev?.name || e}" for category ${gender}`);
    }
    if (!mine.includes(e)) {
      db.regs.push({
        id: Date.now() + Math.random().toString(36).slice(2, 7),
        reg: id,
        name: name.trim(),
        house,
        gender,
        eventId: e,
        registeredAt: new Date().toISOString(),
      });
    }
  }
  save();
  s.json({ ok: true });
});

// Student points & status lookup
app.get("/api/student/:reg", (q, s) => {
  const id = norm(q.params.reg);
  const regs = db.regs.filter((r) => r.reg === id);
  if (!regs.length) return s.status(404).json({ error: "Register number not found" });

  const rows = regs.map((r) => {
    const res = db.results[r.eventId];
    const i = res ? res.places.indexOf(id) : -1;
    const ev = db.events.find((x) => x.id === r.eventId);
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

// Judge views and scoring
app.get("/api/entries/:eid", auth("judge"), (q, s) => {
  const list = db.regs
    .filter((r) => r.eventId === q.params.eid)
    .map((r) => ({
      reg: r.reg,
      name: r.name,
      house: r.house,
      score: db.scores.find((x) => x.eventId === r.eventId && x.reg === r.reg && x.judge === q.get("x-judge"))?.score ?? "",
    }));
  s.json(list);
});

app.post("/api/score", auth("judge"), (q, s) => {
  const { eventId, reg, score } = q.body;
  const judge = q.get("x-judge") || "judge";
  const n = Number(score);
  if (!(n >= 0 && n <= 100)) return bad(s, "Score must be 0 to 100");
  const row = db.scores.find((x) => x.eventId === eventId && x.reg === reg && x.judge === judge);
  row ? (row.score = n) : db.scores.push({ eventId, reg, judge, score: n });
  save();
  s.json({ ok: true });
});

// =================== ADMIN MANAGEMENT ===================

// Update Team / House Names
app.post("/api/admin/teams", auth("admin"), (q, s) => {
  const { houses } = q.body;
  if (!Array.isArray(houses) || !houses.length) return bad(s, "Must provide at least one team");
  const cleaned = houses.map((h) => String(h || "").trim()).filter(Boolean);
  if (!cleaned.length) return bad(s, "Team names cannot be empty");
  db.config.houses = [...new Set(cleaned)];
  save();
  s.json({ ok: true, houses: db.config.houses });
});

// Update Predefined Category Points & Default Points
app.post("/api/admin/points", auth("admin"), (q, s) => {
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
  save();
  s.json({
    ok: true,
    categoryPoints: db.config.categoryPoints,
    defaultPoints: db.config.defaultPoints,
  });
});

// Add or Edit Event (split by Category: Athletics/Games and Gender: Boys/Girls)
app.post("/api/admin/event", auth("admin"), (q, s) => {
  const { id, name, category, gender, type, points } = q.body;
  if (!name || !String(name).trim()) return bad(s, "Event name is required");
  const validCategory = category === "Games" ? "Games" : "Athletics";
  const validGender = String(gender).toLowerCase().includes("girl") || String(gender).toLowerCase().includes("women") ? "Girls" : "Boys";

  const eventPoints =
    Array.isArray(points) && points.length >= 3
      ? points.map(Number)
      : db.config.categoryPoints?.[validCategory] || (validCategory === "Games" ? [10, 6, 2] : [5, 3, 1]);

  const existingIndex = db.events.findIndex((e) => e.id === id);
  const eventId =
    id ||
    `${validCategory.toLowerCase().slice(0, 3)}-${name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")}-${validGender.toLowerCase()}-${Date.now().toString(36).slice(-4)}`;

  const eventObj = {
    id: eventId,
    name: name.trim(),
    category: validCategory,
    gender: validGender,
    type: type || (validCategory === "Games" ? "team" : "track"),
    points: eventPoints,
  };

  if (existingIndex >= 0) {
    db.events[existingIndex] = { ...db.events[existingIndex], ...eventObj };
  } else {
    db.events.push(eventObj);
  }

  save();
  s.json({ ok: true, event: eventObj });
});

// Delete an Event
app.delete("/api/admin/event/:id", auth("admin"), (q, s) => {
  const eid = q.params.id;
  db.events = db.events.filter((e) => e.id !== eid);
  delete db.results[eid];
  db.scores = db.scores.filter((sc) => sc.eventId !== eid);
  db.regs = db.regs.filter((r) => r.eventId !== eid);
  save();
  s.json({ ok: true });
});

// Publish podium places
app.post("/api/publish/:eid", auth("admin"), (q, s) => {
  const eid = q.params.eid;
  let places = q.body.places;
  const evPoints = getEventPoints(eid);

  if (!places) {
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

  places = places.map(norm).filter(Boolean);
  if (!places.length) return bad(s, "No valid register numbers or scores to publish");

  db.results[eid] = { places, at: new Date().toISOString() };
  save();
  s.json({ ok: true, places });
});

// Undo publication
app.post("/api/unpublish/:eid", auth("admin"), (q, s) => {
  delete db.results[q.params.eid];
  save();
  s.json({ ok: true });
});

// Unregister a student entry
app.post("/api/unregister/:id", auth("admin"), (q, s) => {
  db.regs = db.regs.filter((r) => String(r.id) !== String(q.params.id));
  save();
  s.json({ ok: true });
});

// List registrations
app.get("/api/regs", auth("admin"), (_q, s) => s.json(db.regs));

// Export CSV with full details
app.get("/api/export.csv", (q, s) => {
  if (q.query.pin !== PIN.admin) return s.status(401).send("Wrong PIN");
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
app.listen(PORT, () => console.log("Sports Meet API running on port " + PORT));
