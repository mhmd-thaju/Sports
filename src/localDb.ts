// Client-side Local Database & Cloud Migration Module for DCAS Sports Meet
// Faithful to Sportsitem.txt data

export interface EventItem {
  id: string;
  name: string;
  category: "Athletics" | "Games";
  gender: "Boys" | "Girls" | "Mixed";
  type: string;
  points: number[];
  registrationOpen?: boolean;
}

export interface StudentRegistration {
  id: string;
  reg: string;
  name: string;
  house: string;
  gender: string;
  eventId: string;
  picture?: string;
  registeredAt: string;
}

export interface JudgeScore {
  eventId: string;
  reg: string;
  judge: string;
  score: number;
}

export interface PublishedResult {
  places: string[]; // array of student reg numbers
  at: string;
}

export interface JudgePosition {
  reg: string;
  position: number;
}

export interface JudgeSubmission {
  judge: string;
  submittedAt: string;
  positions: JudgePosition[];
}

export interface ActivityLogEntry {
  id: string;
  at: string;
  type: string;
  actorId?: string;
  name: string;
  action: string;
  entityType?: string;
  entityId?: string;
  subjectReg?: string;
  summary?: string;
}

export interface ScheduleItem {
  day: string;
  time: string;
  event: string;
  category: string;
  gender: string;
  location: string;
}

export interface FeaturedWinner {
  id: string;
  event: string;
  category: "Boys" | "Girls" | "Mixed";
  name: string;
  house: string;
  result: string;
  participantReg?: string;
  picture?: string;
}

export interface GalleryPhoto {
  id: string;
  src: string;
  caption?: string;
  at?: string;
  uploadedAt?: string;
  publicId?: string;
}

export interface TournamentDb {
  config: {
    name: string;
    houses: string[];
    maxEventsPerStudent: number;
    categories: string[];
    genders: string[];
    captains: { house: string; name: string; username: string; password: string }[];
    gallery: GalleryPhoto[];
    liveDay: string;
    schedule: ScheduleItem[];
    featuredWinners: FeaturedWinner[];
    categoryPoints: {
      Athletics: number[];
      Games: number[];
    };
    defaultPoints: number[];
  };
  events: EventItem[];
  regs: StudentRegistration[];
  scores: JudgeScore[];
  judgeSubmissions: Record<string, JudgeSubmission>;
  results: Record<string, PublishedResult>;
  auditLogs: ActivityLogEntry[];
}

export const INITIAL_HOUSES = [
  "BCom Co-operation",
  "BA Economics",
  "BCom Finance & BBA",
  "GDA, BCA & Psychology"
];

// Faithful 30 items from Sportsitem.txt
export const SPORTSITEM_EVENTS: EventItem[] = [
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

export function isRelayEvent(event: Pick<EventItem, "id" | "name">): boolean {
  return /relay/i.test(`${event.id} ${event.name}`);
}

export function validateRegistrationRequest(
  db: TournamentDb,
  input: {
    reg?: unknown;
    name?: unknown;
    house?: unknown;
    gender?: unknown;
    eventIds?: unknown;
    picture?: unknown;
  }
): { error: string } | { error: null; reg: string; name: string; house: string; gender: string; eventIds: string[]; picture: string } {
  const reg = String(input.reg || "").trim().toUpperCase();
  const name = String(input.name || "").trim();
  const house = String(input.house || "").trim();
  const gender = String(input.gender || "").trim();
  if (!reg || !name) return { error: "Register number and full name are required" };
  if (!["Boys", "Girls"].includes(gender)) return { error: "Select Boys or Girls division" };
  if (!db.config.houses.includes(house)) return { error: "Select a valid house" };
  if (!Array.isArray(input.eventIds) || input.eventIds.length === 0) return { error: "Choose at least one event" };

  const eventIds = input.eventIds.map((eventId) => String(eventId || "").trim());
  if (eventIds.some((eventId) => !eventId) || new Set(eventIds).size !== eventIds.length) {
    return { error: "Remove duplicate or invalid event selections" };
  }

  const existing = db.regs.filter((registration) => registration.reg.trim().toUpperCase() === reg);
  if (existing.some((registration) =>
    registration.name.trim().toLowerCase() !== name.toLowerCase() ||
    registration.house !== house ||
    registration.gender !== gender
  )) {
    return { error: "Register number already belongs to a different participant" };
  }
  const existingEventIds = new Set(existing.map((registration) => registration.eventId));
  if (eventIds.some((eventId) => existingEventIds.has(eventId))) {
    return { error: "Participant is already registered for a selected event" };
  }

  const selectedEvents = eventIds.map((eventId) => db.events.find((event) => event.id === eventId));
  if (selectedEvents.some((event) => !event || (event.gender !== "Mixed" && event.gender !== gender))) {
    return { error: "Choose valid events for the selected division" };
  }
  if (selectedEvents.some((event) => event?.registrationOpen === false)) {
    return { error: "Registration is closed for one or more selected events" };
  }
  if (eventIds.some((eventId) => db.results[eventId])) {
    return { error: "An event is already published; ask an admin to unpublish it before changing registrations" };
  }

  const athleticsEvents = db.events.filter((event) => event.category === "Athletics");
  const individualAthletics = new Set([
    ...existingEventIds,
    ...eventIds,
  ].filter((eventId) => {
    const event = athleticsEvents.find((item) => item.id === eventId);
    return event && !isRelayEvent(event);
  }));
  const addingAthletics = selectedEvents.some((event) => event?.category === "Athletics");
  if (addingAthletics && individualAthletics.size > 3) {
    return { error: "A participant may enter up to 3 Athletics events, plus one relay" };
  }
  const relayCount = new Set([...existingEventIds, ...eventIds].filter((eventId) => {
    const event = athleticsEvents.find((item) => item.id === eventId);
    return event && isRelayEvent(event);
  })).size;
  if (addingAthletics && relayCount > 1) return { error: "A participant may enter only one relay" };

  for (const event of selectedEvents) {
    if (!event || event.category !== "Athletics") continue;
    const entrants = new Set(
      db.regs
        .filter((registration) => registration.eventId === event.id && registration.house === house)
        .map((registration) => registration.reg.trim().toUpperCase())
    );
    if (entrants.size >= (isRelayEvent(event) ? 4 : 3)) {
      return { error: `${house} has reached the participant limit for ${event.name}` };
    }
  }

  const existingPicture = existing.find((registration) => registration.picture)?.picture || "";
  const picture = String(input.picture || existingPicture);
  if (!picture) return { error: "Participant picture is required" };
  if (picture.length > 3_500_000) return { error: "Participant picture must be smaller than 2.5 MB" };

  return { error: null, reg, name, house, gender, eventIds, picture };
}

const DB_KEY = "dcas_sportsmeet_db_v3_sportsitem";

export function getInitialDb(): TournamentDb {
  return {
    config: {
      name: "DCAS Sports Meet 2026",
      houses: INITIAL_HOUSES,
      maxEventsPerStudent: 3,
      categories: ["Athletics", "Games"],
      genders: ["Boys", "Girls"],
      captains: [],
      gallery: [],
      liveDay: "Day 2",
      schedule: [],
      featuredWinners: [],
      categoryPoints: {
        Athletics: [5, 3, 1],
        Games: [10, 6, 0],
      },
      defaultPoints: [5, 3, 1],
    },
    events: JSON.parse(JSON.stringify(SPORTSITEM_EVENTS)),
    regs: [],
    scores: [],
    judgeSubmissions: {},
    results: {},
    auditLogs: [],
  };
}

export function loadLocalDb(): TournamentDb {
  try {
    const raw = localStorage.getItem(DB_KEY);
    let parsed: TournamentDb;
    if (!raw) {
      parsed = getInitialDb();
      saveLocalDb(parsed);
      return parsed;
    }
    parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.events)) {
      parsed = getInitialDb();
      saveLocalDb(parsed);
      return parsed;
    }
    parsed.config.captains = Array.isArray(parsed.config.captains) ? parsed.config.captains : [];
    parsed.config.gallery = Array.isArray(parsed.config.gallery) ? parsed.config.gallery : [];
    parsed.config.liveDay = parsed.config.liveDay || "Day 2";
    parsed.config.schedule = Array.isArray(parsed.config.schedule) ? parsed.config.schedule : [];
    parsed.config.featuredWinners = Array.isArray(parsed.config.featuredWinners) ? parsed.config.featuredWinners : [];
    parsed.judgeSubmissions = parsed.judgeSubmissions && typeof parsed.judgeSubmissions === "object" ? parsed.judgeSubmissions : {};

    let updated = false;
    parsed.config.categoryPoints = parsed.config.categoryPoints || { Athletics: [5, 3, 1], Games: [10, 6, 0] };
    if (JSON.stringify(parsed.config.categoryPoints.Games) === JSON.stringify([10, 5, 2])) {
      parsed.config.categoryPoints = { ...parsed.config.categoryPoints, Games: [10, 6, 0] };
      updated = true;
    }
    // Keep only the 30 standard items from Sportsitem.txt.
    if (!Array.isArray(parsed.auditLogs)) {
      parsed.auditLogs = [];
      updated = true;
    }
    const existing = new Map(parsed.events.map((event) => [event.id, event]));
    const cleaned = SPORTSITEM_EVENTS.map((standard) => {
      const stored = existing.get(standard.id);
      if (!stored) {
        updated = true;
        return JSON.parse(JSON.stringify(standard));
      }
      const canonical = {
        ...standard,
        type: stored.type || standard.type,
        registrationOpen: stored.registrationOpen !== false,
        points: standard.category === "Games" && JSON.stringify(stored.points) === JSON.stringify([10, 5, 2])
          ? [10, 6, 0]
          : Array.isArray(stored.points) && stored.points.length === 3
            ? stored.points.map(Number)
            : standard.points,
      };
      if (
        stored.name !== canonical.name ||
        stored.category !== canonical.category ||
        stored.gender !== canonical.gender ||
        JSON.stringify(stored.points) !== JSON.stringify(canonical.points) ||
        stored.type !== canonical.type
      ) {
        updated = true;
      }
      return canonical;
    });

    if (updated || cleaned.length !== parsed.events.length || parsed.events.some((event) => !existing.has(event.id))) {
      parsed.events = cleaned;
      saveLocalDb(parsed);
    }

    return parsed;
  } catch {
    const initial = getInitialDb();
    saveLocalDb(initial);
    return initial;
  }
}

export function saveLocalDb(db: TournamentDb): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    dispatchRefresh();
  } catch (err) {
    console.warn("Could not save to localStorage:", err);
  }
}

export function dispatchRefresh(): void {
  try {
    window.dispatchEvent(new CustomEvent("sportsmeet:refresh"));
  } catch {
    // window not available or custom event unsupported
  }
}

// Compute live standings and results from local database
export function computeState(db: TournamentDb) {
  const houses = db.config.houses || INITIAL_HOUSES;
  const st: Record<string, { house: string; gold: number; silver: number; bronze: number; points: number }> =
    Object.fromEntries(houses.map((h) => [h, { house: h, gold: 0, silver: 0, bronze: 0, points: 0 }]));

  const who = (id: string) => {
    const r = db.regs.find((x) => x.reg.trim().toUpperCase() === id.trim().toUpperCase());
    if (r) return { id, name: r.name, house: r.house, picture: r.picture || "" };
    const house = (db.config.houses || []).find((item) => item.trim().toUpperCase() === id.trim().toUpperCase());
    return house ? { id: house, name: `${house} Team`, house } : { id, name: id, house: id };
  };

  const getPoints = (eid: string) => {
    const ev = db.events.find((e) => e.id === eid);
    if (ev && Array.isArray(ev.points) && ev.points.length > 0) return ev.points;
    if (ev && ev.category && db.config.categoryPoints?.[ev.category as "Athletics" | "Games"]) {
      return db.config.categoryPoints[ev.category as "Athletics" | "Games"];
    }
    return db.config.defaultPoints || [5, 3, 1];
  };

  const results: Record<string, { at: string; places: { id: string; name: string; house: string; picture?: string }[] }> = {};

  for (const [eid, r] of Object.entries(db.results || {})) {
    const event = db.events.find((item) => item.id === eid);
    const teamEvent = event?.category === "Games" || (event ? isRelayEvent(event) : false);
    const placesWithDetails = (r.places || []).map((id) => {
      const person = who(id);
      if (!teamEvent || person.picture) return person;
      const representative = db.regs.find(
        (registration) =>
          registration.eventId === eid &&
          registration.house.trim().toUpperCase() === person.house.trim().toUpperCase() &&
          registration.picture
      );
      return { ...person, picture: representative?.picture || "" };
    });
    results[eid] = { at: r.at, places: placesWithDetails };
    const evPoints = getPoints(eid);

    (r.places || []).forEach((id, i) => {
      const person = who(id);
      let h = st[person.house];
      if (!h) {
        st[person.house] = { house: person.house, gold: 0, silver: 0, bronze: 0, points: 0 };
        h = st[person.house];
      }
      h.points += Number(evPoints[i] || 0);
      const medal = ["gold", "silver", "bronze"][i] as "gold" | "silver" | "bronze";
      if (medal) h[medal]++;
    });
  }

  const standings = Object.values(st).sort((a, b) => b.points - a.points || b.gold - a.gold);
  const counts: Record<string, number> = {};
  (db.regs || []).forEach((r) => {
    counts[r.eventId] = (counts[r.eventId] || 0) + 1;
  });

  return { standings, results, counts, published: Object.keys(results).length };
}

// Download helper
export function triggerFileDownload(content: string, filename: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
