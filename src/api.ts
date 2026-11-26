// Unified API and Local Database Sync Client for DCAS Sports Meet
import {
  loadLocalDb,
  saveLocalDb,
  computeState,
  dispatchRefresh,
  SPORTSITEM_EVENTS,
  isRelayEvent,
  validateRegistrationRequest,
  type TournamentDb,
  type EventItem,
  type StudentRegistration,
} from "./localDb";
import { sortGalleryPhotos } from "./galleryUtils";

let pendingApiRequests = 0;

export function getPendingApiRequests() {
  return pendingApiRequests;
}

function dispatchApiActivity(eventName: "sportsmeet:api:start" | "sportsmeet:api:end") {
  if (typeof window === "undefined") return;
  pendingApiRequests = Math.max(0, pendingApiRequests + (eventName.endsWith("start") ? 1 : -1));
  window.dispatchEvent(new Event(eventName));
}

function requiresCloudinaryBackend(path: string) {
  return (
    path === "/captain/register" ||
    path === "/admin/registration" ||
    path === "/admin/gallery" ||
    path.startsWith("/admin/gallery/") ||
    path.startsWith("/unregister/") ||
    path === "/admin/unregister-bulk" ||
    path.startsWith("/captain/unregister")
  );
}

function requiresServerBackend(path: string) {
  return (
    requiresCloudinaryBackend(path) ||
    path === "/auth/verify" ||
    path.startsWith("/admin") ||
    path.startsWith("/captain") ||
    path.startsWith("/judge") ||
    path.startsWith("/entries/") ||
    path === "/score" ||
    path.startsWith("/publish/") ||
    path.startsWith("/unpublish/") ||
    path.startsWith("/unregister/") ||
    path === "/regs" ||
    path === "/export.csv" ||
    path.startsWith("/student/") ||
    path.startsWith("/activity/gallery/")
  );
}

export function trackGalleryActivity(photoId: string, action: "open" | "download_click"): void {
  void fetch(`/api/activity/gallery/${encodeURIComponent(photoId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
    keepalive: true,
  }).then((response) => {
    if (!response.ok) console.error("Gallery activity could not be recorded", response.status);
  }).catch((error: unknown) => {
    console.error("Gallery activity could not be recorded", error);
  });
}

export async function api(
  path: string,
  body?: unknown,
  pin?: string,
  judge?: string,
  explicitMethod?: "GET" | "POST" | "DELETE" | "PUT"
) {
  // Infer HTTP method
  let method = explicitMethod;
  if (!method) {
    if (path.startsWith("/admin/event/") && (body === undefined || (body && typeof body === "object" && Object.keys(body).length === 0))) {
      method = "DELETE";
    } else {
      method = body !== undefined ? "POST" : "GET";
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pin) headers["x-pin"] = pin;
  if (judge && path.startsWith("/captain/")) headers["x-captain"] = judge;

  let r: Response;
  dispatchApiActivity("sportsmeet:api:start");
  try {
    r = await fetch("/api" + path, {
      method,
      headers,
      body: body && method !== "GET" ? JSON.stringify(body) : undefined,
    });
  } catch {
    if (requiresServerBackend(path)) {
      throw new Error("This action requires the Sports Meet server to be available. Please try again.");
    }
    return handleLocalDbFallback(path, method, body, pin, judge);
  } finally {
    dispatchApiActivity("sportsmeet:api:end");
  }

  const isJson = r.headers.get("content-type")?.includes("application/json");
  const j = isJson ? await r.json().catch(() => ({})) : await r.text();

  if (!r.ok) {
    // If backend proxy offline (504/502/503) or 404, smoothly use local DB
    if (r.status >= 500 || r.status === 404) {
      if (requiresServerBackend(path)) {
        const errMsg = typeof j === "object" && j !== null ? (j as any).error : String(j);
        throw new Error(errMsg || "This action requires the Sports Meet server to be available.");
      }
      return handleLocalDbFallback(path, method, body, pin, judge);
    }
    const errMsg = typeof j === "object" && j !== null ? (j as any).error : String(j);
    throw new Error(errMsg || "Request failed with status " + r.status);
  }

  // On mutative requests, dispatch instant refresh for all UI listeners
  if (method !== "GET") {
    dispatchRefresh();
  }

  // Mirror config/state updates to local DB for resilience
  if (path === "/config" && typeof j === "object" && j !== null && (j as any).events) {
    const db = loadLocalDb();
    db.config = {
      name: (j as any).name || db.config.name,
      houses: (j as any).houses || db.config.houses,
      maxEventsPerStudent: (j as any).maxEventsPerStudent || 3,
      categories: (j as any).categories || ["Athletics", "Games"],
      genders: (j as any).genders || ["Boys", "Girls"],
      categoryPoints: (j as any).categoryPoints || db.config.categoryPoints,
      defaultPoints: (j as any).defaultPoints || db.config.defaultPoints,
      captains: db.config.captains,
      gallery: Array.isArray((j as any).gallery) ? (j as any).gallery : db.config.gallery,
      liveDay: (j as any).liveDay || db.config.liveDay,
      schedule: Array.isArray((j as any).schedule) ? (j as any).schedule : db.config.schedule,
      featuredWinners: Array.isArray((j as any).featuredWinners) ? (j as any).featuredWinners : db.config.featuredWinners,
    };
    db.events = (j as any).events;
    saveLocalDb(db);
  }

  return j;
}

function requireLocalAdmin(pin?: string) {
  const sessionPin = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("pin-admin");
  if (!pin || !sessionPin || pin !== sessionPin) throw new Error("Wrong PIN");
}

function requireLocalJudge(pin?: string) {
  const sessionPin = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("pin-judge");
  if (!pin || !sessionPin || pin !== sessionPin) throw new Error("Wrong PIN");
}

function getLocalJudgeEntries(db: TournamentDb, eventId: string) {
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw new Error("Event not found");
  const registered = db.regs.filter((registration) => registration.eventId === eventId);
  const rosterEvents = event.category === "Games" || isRelayEvent(event);
  const participants = rosterEvents
    ? [...new Map(registered.map((registration) => [registration.house, {
        reg: registration.house,
        name: `${registration.house} Team`,
        house: registration.house,
        members: registered.filter((member) => member.house === registration.house).length,
      }])).values()]
    : [...new Map(registered.map((registration) => [registration.reg, {
        reg: registration.reg.trim().toUpperCase(),
        name: registration.name,
        house: registration.house,
      }])).values()];
  if (rosterEvents && participants.length === 0) {
    return db.config.houses.map((house) => ({ reg: house, name: `${house} Team`, house, members: 0 }));
  }
  return participants;
}

function handleLocalDbFallback(
  path: string,
  method: string,
  body?: any,
  pin?: string,
  judge?: string
): any {
  const db = loadLocalDb();

  // GET /api/config
  if (path === "/config") {
    return {
      name: db.config.name,
      houses: db.config.houses,
      maxEventsPerStudent: db.config.maxEventsPerStudent,
      categories: db.config.categories,
      genders: db.config.genders,
      categoryPoints: db.config.categoryPoints,
      defaultPoints: db.config.defaultPoints,
      gallery: db.config.gallery,
      liveDay: db.config.liveDay,
      schedule: db.config.schedule,
      featuredWinners: db.config.featuredWinners.map((winner) => ({
        ...winner,
        picture: db.regs.find(
          (registration) =>
            registration.reg.trim().toUpperCase() === String(winner.participantReg || "").trim().toUpperCase()
        )?.picture || "",
      })),
      events: db.events,
    };
  }

  if (path === "/gallery") {
    return { photos: sortGalleryPhotos(db.config.gallery) };
  }

  // GET /api/state
  if (path === "/state") {
    return computeState(db);
  }

  // GET /api/regs
  if (path === "/regs") {
    requireLocalAdmin(pin);
    return db.regs;
  }

  if (path === "/captain/registrations") {
    const username = String(judge || "").trim().toLowerCase();
    const captain = (db.config.captains || []).find(
      (item) => item.username === username && item.password === String(pin || "")
    );
    if (!captain) throw new Error("Invalid house captain credentials");
    return db.regs.filter((registration) => registration.house === captain.house);
  }

  // GET /api/student/:reg
  if (path.startsWith("/student/")) {
    const reg = decodeURIComponent(path.replace("/student/", "")).trim().toUpperCase();
    const regs = db.regs.filter((r) => r.reg.trim().toUpperCase() === reg);
    if (!regs.length) throw new Error("Register number not found");

    const getEvPoints = (eid: string) => {
      const ev = db.events.find((e) => e.id === eid);
      if (ev && Array.isArray(ev.points) && ev.points.length > 0) return ev.points;
      if (ev && ev.category && db.config.categoryPoints?.[ev.category as "Athletics" | "Games"]) {
        return db.config.categoryPoints[ev.category as "Athletics" | "Games"];
      }
      return db.config.defaultPoints || [5, 3, 1];
    };

    const rows = regs.map((r) => {
      const res = db.results[r.eventId];
      const ev = db.events.find((x) => x.id === r.eventId);
      const resultId = ev && (ev.category === "Games" || /relay/i.test(`${ev.id} ${ev.name}`)) ? r.house.trim().toUpperCase() : reg;
      const i = res ? res.places.indexOf(resultId) : -1;
      const evPoints = getEvPoints(r.eventId);
      return {
        eventId: r.eventId,
        eventName: ev?.name || r.eventId,
        category: ev?.category || "General",
        gender: ev?.gender || r.gender,
        status: !res ? "Pending" : i < 0 ? "Participated" : ["1st Place 🥇", "2nd Place 🥈", "3rd Place 🥉"][i] || "Placed",
        points: i >= 0 ? Number(evPoints[i] || 0) : 0,
      };
    });

    return {
      reg,
      name: regs[0].name,
      house: regs[0].house,
      gender: regs[0].gender,
      rows,
      total: rows.reduce((a, r) => a + r.points, 0),
    };
  }

  // POST /api/register
  if (path === "/register") {
    throw new Error("Registration is available only through an authorized house captain");
  }

  // POST /api/captain/login
  if (path === "/captain/login") {
    const { username, password } = body || {};
    const captain = (db.config.captains || []).find(
      (c) => c.username === String(username || "").trim().toLowerCase() && c.password === String(password || "")
    );
    if (!captain) throw new Error("Invalid house captain credentials");
    return { ok: true, house: captain.house, username: captain.username, name: captain.name || captain.username };
  }

  // POST /api/captain/register
  if (path === "/captain/register") {
    const username = String(judge || "").trim().toLowerCase();
    const password = String(pin || "");
    const captain = (db.config.captains || []).find((c) => c.username === username && c.password === password);
    if (!captain) throw new Error("Invalid house captain credentials");

    const registration = validateRegistrationRequest(db, { ...body, house: captain.house });
    if (registration.error !== null) throw new Error(registration.error);
    const registeredAt = new Date().toISOString();
    for (const eventId of registration.eventIds) {
      delete db.judgeSubmissions[eventId];
      db.regs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        reg: registration.reg,
        name: registration.name,
        house: registration.house,
        gender: registration.gender,
        eventId,
        picture: registration.picture,
        registeredAt,
      });
    }
    saveLocalDb(db);
    return { ok: true, added: registration.eventIds.length };
  }

  if (path === "/admin/registration") {
    requireLocalAdmin(pin);
    const registration = validateRegistrationRequest(db, body || {});
    if (registration.error !== null) throw new Error(registration.error);
    const registeredAt = new Date().toISOString();
    for (const eventId of registration.eventIds) {
      delete db.judgeSubmissions[eventId];
      db.regs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        reg: registration.reg,
        name: registration.name,
        house: registration.house,
        gender: registration.gender,
        eventId,
        picture: registration.picture,
        registeredAt,
      });
    }
    saveLocalDb(db);
    return { ok: true, added: registration.eventIds.length };
  }

  // DELETE /api/admin/event/:id or POST /api/admin/event/:id/delete
  if (path.startsWith("/admin/event/") && (method === "DELETE" || path.endsWith("/delete") || !body || Object.keys(body).length === 0)) {
    const eid = path.replace("/admin/event/", "").replace("/delete", "");
    db.events = db.events.filter((e) => e.id !== eid);
    delete db.results[eid];
    delete db.judgeSubmissions[eid];
    db.scores = db.scores.filter((sc) => sc.eventId !== eid);
    db.regs = db.regs.filter((r) => r.eventId !== eid);
    saveLocalDb(db);
    return { ok: true, deletedId: eid, events: db.events };
  }

  // POST /api/admin/event
  if (path === "/admin/event") {
    const { id, name, category, gender, type, points } = body || {};
    if (!name || !String(name).trim()) throw new Error("Event name is required");
    const validCategory = category === "Games" ? "Games" : "Athletics";
    const validGender = String(gender).toLowerCase().includes("girl") || String(gender).toLowerCase().includes("women") ? "Girls" : "Boys";
    const standard = SPORTSITEM_EVENTS.find((e) => e.id === id) ||
      SPORTSITEM_EVENTS.find((e) =>
        e.name.toLowerCase() === String(name).trim().toLowerCase() &&
        e.category === validCategory &&
        e.gender === validGender
      );
    if (!standard) throw new Error("Only the events listed in Sportsitem.txt can be added");
    const eventPoints =
      Array.isArray(points) && points.length >= 3
        ? points.map(Number)
        : db.config.categoryPoints?.[validCategory] || (validCategory === "Games" ? [10, 6, 0] : [5, 3, 1]);

    const existingIndex = db.events.findIndex((e) => e.id === standard.id);
    const eventId = standard.id;

    const eventObj: EventItem = {
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
    saveLocalDb(db);
    return { ok: true, event: eventObj, events: db.events };
  }

  if (path.startsWith("/admin/event/") && path.endsWith("/registration")) {
    const eventId = path.slice("/admin/event/".length, -"/registration".length);
    const event = db.events.find((item) => item.id === eventId);
    if (!event) throw new Error("Event not found");
    if (typeof body?.open !== "boolean") throw new Error("Registration status must be open or closed");
    event.registrationOpen = body.open;
    saveLocalDb(db);
    return { ok: true, event };
  }

  // POST /api/admin/points
  if (path === "/admin/points") {
    const { categoryPoints, defaultPoints } = body || {};
    if (categoryPoints && typeof categoryPoints === "object") {
      db.config.categoryPoints = { ...db.config.categoryPoints, ...categoryPoints };
    }
    if (Array.isArray(defaultPoints) && defaultPoints.length) {
      db.config.defaultPoints = defaultPoints.map(Number);
    }
    saveLocalDb(db);
    return { ok: true, categoryPoints: db.config.categoryPoints, defaultPoints: db.config.defaultPoints };
  }

  // POST /api/admin/teams
  if (path === "/admin/teams") {
    const { houses } = body || {};
    if (!Array.isArray(houses) || !houses.length) throw new Error("Must provide at least one team");
    const cleaned = houses.map((h: string) => String(h || "").trim()).filter(Boolean);
    if (!cleaned.length) throw new Error("Team names cannot be empty");
    db.config.houses = [...new Set(cleaned)];
    saveLocalDb(db);
    return { ok: true, houses: db.config.houses };
  }

  if (path === "/admin/site-content") {
    const { liveDay, schedule, featuredWinners } = body || {};
    if (!String(liveDay || "").trim()) throw new Error("Live day is required");
    if (!Array.isArray(schedule) || !Array.isArray(featuredWinners)) throw new Error("Schedule and featured winners must be lists");
    const cleanSchedule = schedule
      .map((item: any) => ({
        day: String(item.day || "").trim(),
        time: String(item.time || "").trim(),
        event: String(item.event || "").trim(),
        category: String(item.category || "").trim(),
        gender: String(item.gender || "").trim(),
        location: String(item.location || "").trim(),
      }));
    if (cleanSchedule.some((item: any) => !item.day || !item.time || !item.event || !item.location)) {
      throw new Error("Every schedule row must include Day, Time, Event, and Location");
    }
    const cleanWinners = featuredWinners
      .map((winner: any) => ({
        id: String(winner.id || Date.now() + Math.random()),
        event: String(winner.event || "").trim(),
        category: ["Boys", "Girls", "Mixed"].includes(winner.category) ? winner.category : "Mixed",
        name: String(winner.name || "").trim(),
        house: String(winner.house || "").trim(),
        participantReg: db.regs.some(
          (registration) =>
            registration.reg.trim().toUpperCase() === String(winner.participantReg || "").trim().toUpperCase()
        ) ? String(winner.participantReg || "").trim().toUpperCase() : "",
        result: String(winner.result || "").trim(),
      }));
    if (cleanWinners.some((winner: any) => !winner.event || !winner.name)) {
      throw new Error("Every featured winner must include an Event and Winner / team name");
    }
    db.config.liveDay = String(liveDay).trim();
    db.config.schedule = cleanSchedule;
    db.config.featuredWinners = cleanWinners;
    saveLocalDb(db);
    return { ok: true, liveDay: db.config.liveDay, schedule: db.config.schedule, featuredWinners: db.config.featuredWinners };
  }

  // POST /api/admin/captains
  if (path === "/admin/captains") {
    requireLocalAdmin(pin);
    if (method === "GET") return { captains: db.config.captains || [] };
    const { captains } = body || {};
    if (!Array.isArray(captains)) throw new Error("Captain list is required");
    db.config.captains = captains
      .map((c: any) => ({
        house: String(c.house || "").trim(),
        name: String(c.name || "").trim(),
        username: String(c.username || "").trim().toLowerCase(),
        password: String(c.password || ""),
      }))
      .filter((c: any) => c.house && c.username && c.password);
    saveLocalDb(db);
    return { ok: true, captains: db.config.captains };
  }

  // POST /api/admin/gallery
  if (path === "/admin/gallery") {
    const { photo, caption } = body || {};
    if (!photo) throw new Error("A photo is required");
    const item = { id: Date.now().toString(36), src: String(photo), caption: String(caption || ""), at: new Date().toISOString() };
    db.config.gallery = [item, ...(db.config.gallery || [])].slice(0, 200);
    saveLocalDb(db);
    return { ok: true, gallery: db.config.gallery };
  }

  if (path.startsWith("/admin/gallery/") && method === "DELETE") {
    const id = path.replace("/admin/gallery/", "");
    db.config.gallery = (db.config.gallery || []).filter((item) => item.id !== id);
    saveLocalDb(db);
    return { ok: true, gallery: db.config.gallery };
  }

  // POST /api/admin/reset-events
  if (path === "/admin/reset-events") {
    db.events = JSON.parse(JSON.stringify(SPORTSITEM_EVENTS));
    db.config.categoryPoints = { Athletics: [5, 3, 1], Games: [10, 6, 0] };
    db.config.defaultPoints = [5, 3, 1];
    if (body?.clearRegistrations) {
      db.regs = [];
      db.scores = [];
      db.judgeSubmissions = {};
      db.results = {};
    }
    saveLocalDb(db);
    return { ok: true, events: db.events };
  }

  // POST /api/publish/:eid
  if (path.startsWith("/publish/")) {
    const eid = path.replace("/publish/", "");
    const event = db.events.find((item) => item.id === eid);
    if (!event) throw new Error("Event not found");
    let places: string[] = Array.isArray(body?.places) ? body.places.map((p: string) => String(p).trim()) : [];
    if (!places.length) {
      places = (db.judgeSubmissions[eid]?.positions || [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .slice(0, event.category === "Games" ? 4 : 3)
        .map((item) => item.reg);
    }
    if (!places.length) throw new Error("No judge submission or podium positions are available to publish");
    if (event.category === "Games" || isRelayEvent(event)) {
      places = places.map((place) =>
        db.regs.find((registration) => registration.eventId === eid && registration.reg.trim().toUpperCase() === place.toUpperCase())?.house ||
        db.config.houses.find((house) => house.toUpperCase() === place.toUpperCase()) ||
        ""
      );
    }
    places = places.map((place) => String(place).trim().toUpperCase()).filter(Boolean);
    if (new Set(places).size !== places.length) throw new Error("Each podium position must be assigned to a different participant or team");
    const validEntries = getLocalJudgeEntries(db, eid);
    const entryIds = new Set(validEntries.map((entry) => entry.reg.toUpperCase()));
    if (places.some((place) => !entryIds.has(place.toUpperCase()))) throw new Error("Choose registered participants or teams for the podium");
    places = places.slice(0, event.category === "Games" ? 4 : 3);
    db.results[eid] = { places, at: new Date().toISOString() };
    saveLocalDb(db);
    return { ok: true, places };
  }

  // POST /api/unpublish/:eid
  if (path.startsWith("/unpublish/")) {
    const eid = path.replace("/unpublish/", "");
    delete db.results[eid];
    saveLocalDb(db);
    return { ok: true };
  }

  // POST /api/unregister/:id
  if (path.startsWith("/unregister/")) {
    const id = path.replace("/unregister/", "");
    const removed = db.regs.find((registration) => String(registration.id) === id);
    if (removed && db.results[removed.eventId]) {
      throw new Error("Unpublish this event before removing a registered participant");
    }
    if (removed) delete db.judgeSubmissions[removed.eventId];
    db.regs = db.regs.filter((r) => String(r.id) !== String(id));
    saveLocalDb(db);
    return { ok: true };
  }

  if (path === "/admin/judge-submissions") {
    requireLocalAdmin(pin);
    return db.judgeSubmissions;
  }

  // GET /api/entries/:eid
  if (path.startsWith("/entries/")) {
    const eid = path.replace("/entries/", "");
    requireLocalJudge(pin);
    const entries = getLocalJudgeEntries(db, eid);
    const submission = db.judgeSubmissions[eid] || null;
    const positions = new Map((submission?.positions || []).map((item) => [item.reg, item.position]));
    return {
      entries: entries.map((entry) => ({ ...entry, position: positions.get(entry.reg) || "" })),
      submission,
      published: Boolean(db.results[eid]),
    };
  }

  if (path.startsWith("/judge/submit/")) {
    requireLocalJudge(pin);
    const eventId = path.replace("/judge/submit/", "");
    if (db.results[eventId]) throw new Error("This event is already published; ask an admin to unpublish it before resubmitting");
    const entries = getLocalJudgeEntries(db, eventId);
    const event = db.events.find((item) => item.id === eventId);
    const isGamesEvent = event?.category === "Games";
    if (!entries.length) throw new Error("No registered participants or teams are available to rank");
    const positions = body?.positions;
    if (!Array.isArray(positions) || (isGamesEvent ? positions.length < 2 || positions.length > Math.min(4, entries.length) : positions.length !== entries.length)) {
      throw new Error("Assign a position to every participant or team before submitting");
    }
    const allowed = new Set(entries.map((entry) => entry.reg));
    const regs = positions.map((item: any) => String(item.reg || "").trim());
    const ranks = positions.map((item: any) => Number(item.position));
    const sequentialGameRanks = [...ranks].sort((a, b) => a - b).every((rank, index) => rank === index + 1);
    if (
      regs.some((reg: string) => !allowed.has(reg)) ||
      new Set(regs).size !== positions.length ||
      ranks.some((rank: number) => !Number.isInteger(rank) || rank < 1 || rank > (isGamesEvent ? Math.min(4, entries.length) : entries.length)) ||
      new Set(ranks).size !== positions.length ||
      (isGamesEvent && (!ranks.includes(1) || !ranks.includes(2) || !sequentialGameRanks))
    ) {
      throw new Error(isGamesEvent
        ? "Games results require unique 1st and 2nd; optional 3rd and 4th places must be consecutive"
        : "Positions must rank every listed entry once, from 1 to the number of participants");
    }
    const submission = {
      judge: String(judge || "judge"),
      submittedAt: new Date().toISOString(),
      positions: positions.map((item: any) => ({ reg: String(item.reg), position: Number(item.position) })).sort((a: any, b: any) => a.position - b.position),
    };
    db.judgeSubmissions[eventId] = submission;
    saveLocalDb(db);
    return { ok: true, submission };
  }

  // POST /api/score
  if (path === "/score") {
    const { eventId, reg, score } = body || {};
    const n = Number(score);
    if (!(n >= 0 && n <= 100)) throw new Error("Score must be 0 to 100");
    const jName = judge || "judge";
    const row = db.scores.find((x) => x.eventId === eventId && x.reg === reg && x.judge === jName);
    row ? (row.score = n) : db.scores.push({ eventId, reg, judge: jName, score: n });
    saveLocalDb(db);
    return { ok: true };
  }

  return { ok: true };
}
