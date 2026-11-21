import { useEffect, useState } from "react";
import { api } from "../api";
import { usePoll } from "../hooks";
import PinGate from "../components/PinGate";
import { triggerFileDownload, SPORTSITEM_EVENTS, isRelayEvent } from "../localDb";

interface EventItem {
  id: string;
  name: string;
  category: "Athletics" | "Games";
  gender: "Boys" | "Girls";
  type: string;
  points?: number[];
}

function Panel({ pin }: { pin: string }) {
  const cfg = usePoll("/config", 5000);
  const s = usePoll("/state", 3000);
  const regs = usePoll<any[]>("/regs", 5000, pin);
  const judgeSubmissions = usePoll<Record<string, any>>("/admin/judge-submissions", 5000, pin);

  // Active top-level tab
  const [adminTab, setAdminTab] = useState<"events" | "points" | "teams" | "captains" | "gallery" | "site" | "regs" | "activity" | "db">("events");
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityPage, setActivityPage] = useState(0);
  const activityLogPath = `/admin/activity-log?limit=100&offset=${activityPage * 100}${activityFilter === "all" ? "" : `&type=${encodeURIComponent(activityFilter)}`}`;
  const activityLogs = usePoll<{ entries: any[]; total: number }>(activityLogPath, 10000, pin);

  // Filter state for Events tab
  const [activeCategory, setActiveCategory] = useState<"Athletics" | "Games">("Athletics");
  const [activeGender, setActiveGender] = useState<"Boys" | "Girls">("Boys");

  // Results publishing manual inputs: eventId -> comma-separated reg numbers
  const [manual, setManual] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Event modal/form state
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [eventForm, setEventForm] = useState<{
    id?: string;
    name: string;
    category: "Athletics" | "Games";
    gender: "Boys" | "Girls";
    type: string;
    p1: number;
    p2: number;
    p3: number;
  }>({
    name: "",
    category: "Athletics",
    gender: "Boys",
    type: "track",
    p1: 5,
    p2: 3,
    p3: 1,
  });

  // Points configuration state
  const [pointsForm, setPointsForm] = useState<{
    ath1: number;
    ath2: number;
    ath3: number;
    game1: number;
    game2: number;
    game3: number;
  } | null>(null);

  // Teams configuration state
  const [teamsList, setTeamsList] = useState<string[] | null>(null);
  const [newTeamInput, setNewTeamInput] = useState("");
  const [captainsList, setCaptainsList] = useState<any[] | null>(null);
  const [captainsLoaded, setCaptainsLoaded] = useState(false);
  const [galleryCaption, setGalleryCaption] = useState("");
  const [siteContentLoaded, setSiteContentLoaded] = useState(false);
  const [liveDay, setLiveDay] = useState("Day 2");
  const [scheduleRows, setScheduleRows] = useState<any[]>([]);
  const [featuredWinners, setFeaturedWinners] = useState<any[]>([]);
  const [winnerDraft, setWinnerDraft] = useState({
    event: "",
    category: "Boys",
    name: "",
    house: "",
    result: "",
    participantReg: "",
  });

  // Search filter for registrations
  const [regSearch, setRegSearch] = useState("");
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<string[]>([]);
  const [registrationDraft, setRegistrationDraft] = useState({
    reg: "",
    name: "",
    house: "",
    gender: "",
    eventIds: [] as string[],
    picture: "",
  });

  useEffect(() => {
    if (siteContentLoaded || !cfg) return;
    setLiveDay(cfg.liveDay || "Day 2");
    setScheduleRows(Array.isArray(cfg.schedule) ? cfg.schedule : []);
    setFeaturedWinners(Array.isArray(cfg.featuredWinners) ? cfg.featuredWinners : []);
    setSiteContentLoaded(true);
  }, [cfg, siteContentLoaded]);

  useEffect(() => {
    if (captainsLoaded) return;
    let active = true;
    api("/admin/captains", undefined, pin)
      .then((result) => {
        if (active) setCaptainsList(result.captains || []);
      })
      .catch((e) => {
        if (active) setMsg({ text: e.message, isError: true });
      })
      .finally(() => {
        if (active) setCaptainsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [captainsLoaded, pin]);

  if (!cfg || !s) return <p className="muted">Loading tournament data…</p>;

  // Initialize points form from live config if not edited
  // Faithful to Sportsitem.txt defaults: Athletics [5, 3, 1], Games [10, 5, 2]
  const currentCategoryPoints = cfg.categoryPoints || { Athletics: [5, 3, 1], Games: [10, 5, 2] };
  const pointsState = pointsForm || {
    ath1: currentCategoryPoints.Athletics?.[0] ?? 5,
    ath2: currentCategoryPoints.Athletics?.[1] ?? 3,
    ath3: currentCategoryPoints.Athletics?.[2] ?? 1,
    game1: currentCategoryPoints.Games?.[0] ?? 10,
    game2: currentCategoryPoints.Games?.[1] ?? 5,
    game3: currentCategoryPoints.Games?.[2] ?? 2,
  };

  // Initialize teams list from live config if not edited
  const currentTeams = teamsList || (cfg.houses as string[]) || [];

  const flash = (text: string, isError = false) => {
    setMsg({ text, isError });
    setTimeout(() => setMsg(null), 5000);
  };

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem("pin-admin");
    sessionStorage.removeItem("name-admin");
    window.location.reload();
  };

  // Publish / Unpublish results
  const publishPlaces = (eid: string) => {
    const raw = manual[eid];
    const places = raw ? raw.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
    api("/publish/" + eid, { places }, pin)
      .then(() => flash("Podium published successfully ✓"))
      .catch((e) => flash(e.message, true));
  };

  const publishJudgeResults = (eid: string) => {
    api("/publish/" + eid, {}, pin)
      .then(() => flash("Judge results published successfully ✓"))
      .catch((e) => flash(e.message, true));
  };

  const unpublishEvent = (eid: string) => {
    if (!confirm("Are you sure you want to undo the published results for this event?")) return;
    api("/unpublish/" + eid, {}, pin)
      .then(() => flash("Result unpublished ✓"))
      .catch((e) => flash(e.message, true));
  };

  // Add / Edit Event
  const openAddEvent = () => {
    const catPoints = activeCategory === "Games" ? [pointsState.game1, pointsState.game2, pointsState.game3] : [pointsState.ath1, pointsState.ath2, pointsState.ath3];
    setEventForm({
      name: "",
      category: activeCategory,
      gender: activeGender,
      type: activeCategory === "Games" ? "team" : "track",
      p1: catPoints[0],
      p2: catPoints[1],
      p3: catPoints[2],
    });
    setIsEditingEvent(true);
  };

  const openEditEvent = (ev: EventItem) => {
    const pts = ev.points || (ev.category === "Games" ? [pointsState.game1, pointsState.game2, pointsState.game3] : [pointsState.ath1, pointsState.ath2, pointsState.ath3]);
    setEventForm({
      id: ev.id,
      name: ev.name,
      category: ev.category,
      gender: ev.gender,
      type: ev.type,
      p1: pts[0] ?? 5,
      p2: pts[1] ?? (ev.category === "Games" ? 5 : 3),
      p3: pts[2] ?? (ev.category === "Games" ? 2 : 1),
    });
    setIsEditingEvent(true);
  };

  const saveEvent = async () => {
    if (!eventForm.name.trim()) {
      flash("Please enter an event name", true);
      return;
    }
    try {
      await api(
        "/admin/event",
        {
          id: eventForm.id,
          name: eventForm.name.trim(),
          category: eventForm.category,
          gender: eventForm.gender,
          type: eventForm.type,
          points: [Number(eventForm.p1), Number(eventForm.p2), Number(eventForm.p3)],
        },
        pin
      );
      setIsEditingEvent(false);
      flash(`Event "${eventForm.name}" saved ✓`);
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  // Delete event with explicit DELETE method & immediate UI update
  const deleteEvent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete event "${name}"? Any published results and registrations for it will be removed.`)) return;
    try {
      await api("/admin/event/" + id, undefined, pin, undefined, "DELETE");
      flash(`Event "${name}" deleted successfully ✓`);
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  // Save Predefined Points
  const savePointsConfig = async () => {
    try {
      await api(
        "/admin/points",
        {
          categoryPoints: {
            Athletics: [Number(pointsState.ath1), Number(pointsState.ath2), Number(pointsState.ath3)],
            Games: [Number(pointsState.game1), Number(pointsState.game2), Number(pointsState.game3)],
          },
          defaultPoints: [Number(pointsState.ath1), Number(pointsState.ath2), Number(pointsState.ath3)],
        },
        pin
      );
      flash("Predefined points updated and saved to local database ✓");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  // Save Teams
  const handleAddTeam = () => {
    const t = newTeamInput.trim();
    if (!t) return;
    if (currentTeams.some((x) => x.toLowerCase() === t.toLowerCase())) {
      flash("Team name already exists", true);
      return;
    }
    setTeamsList([...currentTeams, t]);
    setNewTeamInput("");
  };

  const handleRenameTeam = (idx: number, val: string) => {
    const updated = [...currentTeams];
    updated[idx] = val;
    setTeamsList(updated);
  };

  const handleRemoveTeam = (idx: number) => {
    if (currentTeams.length <= 2) {
      flash("At least two teams are required for the sports meet", true);
      return;
    }
    const updated = currentTeams.filter((_, i) => i !== idx);
    setTeamsList(updated);
  };

  const saveTeamsConfig = async () => {
    try {
      await api("/admin/teams", { houses: currentTeams }, pin);
      flash("Team names saved to local database ✓");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const currentCaptains = captainsList || [];

  const generateCaptainCredentials = () => {
    const existing = new Map(currentCaptains.map((c) => [c.house, c]));
    setCaptainsList(
      currentTeams.map((house) => {
        const current = existing.get(house);
        const slug = house.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return current || {
          house,
          name: `${house} Captain`,
          username: `${slug}-captain`,
          password: `${slug.slice(0, 4)}${Math.floor(1000 + Math.random() * 9000)}`,
        };
      })
    );
  };

  const saveCaptainCredentials = async () => {
    try {
      await api("/admin/captains", { captains: currentCaptains }, pin);
      flash("House captain credentials saved ✓");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const uploadGalleryPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 2_500_000) {
      flash("Choose an image smaller than 2.5 MB", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api("/admin/gallery", { photo: String(reader.result || ""), caption: galleryCaption }, pin);
        setGalleryCaption("");
        flash("Gallery photo published ✓");
      } catch (e: any) {
        flash(e.message, true);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeGalleryPhoto = async (id: string) => {
    try {
      await api("/admin/gallery/" + id, undefined, pin, undefined, "DELETE");
      flash("Gallery photo removed ✓");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const readRegistrationPicture = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      flash("Choose an image file", true);
      return;
    }
    if (file.size > 2_500_000) {
      flash("Choose an image smaller than 2.5 MB", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setRegistrationDraft((current) => ({ ...current, picture: String(reader.result || "") }));
    reader.onerror = () => flash("Could not read the selected image", true);
    reader.readAsDataURL(file);
  };

  const addAdminRegistration = async () => {
    const existing = (regs || []).filter((registration) => registration.reg === registrationDraft.reg.trim().toUpperCase());
    if (!registrationDraft.reg.trim() || !registrationDraft.name.trim()) {
      flash("Register number and full name are required", true);
      return;
    }
    if (!registrationDraft.house || !registrationDraft.gender || !registrationDraft.eventIds.length) {
      flash("Select a house, division, and at least one event", true);
      return;
    }
    if (!registrationDraft.picture && !existing.some((registration) => registration.picture)) {
      flash("Participant picture is required", true);
      return;
    }
    try {
      const result = await api(
        "/admin/registration",
        { ...registrationDraft, reg: registrationDraft.reg.trim().toUpperCase(), name: registrationDraft.name.trim() },
        pin
      );
      setRegistrationDraft({ reg: "", name: "", house: "", gender: "", eventIds: [], picture: "" });
      flash(`Participant registered successfully (${result.added} event${result.added === 1 ? "" : "s"}) ✓`);
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const downloadScheduleCsvTemplate = () => {
    const header = "Day,Time,Event,Category,Gender,Location";
    const sample = "Day 1,08:00,100m,Athletics,Boys,Main Athletics Track";
    triggerFileDownload(`${header}\n${sample}\n`, "sports-meet-schedule-template.csv", "text/csv");
  };

  const downloadScheduleExcelTemplate = async () => {
    const XLSX = await import("@e965/xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Day", "Time", "Event", "Category", "Gender", "Location"],
      ["Day 1", "08:00", "100m", "Athletics", "Boys", "Main Athletics Track"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Schedule");
    XLSX.writeFile(workbook, "sports-meet-schedule-template.xlsx");
  };

  const importSchedule = async (file?: File) => {
    if (!file) return;
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      flash("Upload a .csv, .xlsx, or .xls schedule file", true);
      return;
    }
    try {
      const XLSX = await import("@e965/xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("The spreadsheet has no worksheet");
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
      const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/[\s_-]+/g, "");
      const rows = rawRows.map((row, index) => {
        const values = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? "").trim()]));
        const get = (...keys: string[]) => keys.map((key) => values.get(key)).find(Boolean) || "";
        return {
          day: get("day", "date"),
          time: get("time", "starttime"),
          event: get("event", "eventname"),
          category: get("category", "type"),
          gender: get("gender", "division"),
          location: get("location", "venue"),
          rowNumber: index + 2,
        };
      }).filter((row) => row.day || row.time || row.event || row.category || row.gender || row.location);
      if (!rows.length) throw new Error("The schedule has no data rows");
      const invalid = rows.find((row) => !row.day || !row.time || !row.event || !row.location);
      if (invalid) {
        throw new Error(`Row ${invalid.rowNumber} must include Day, Time, Event, and Location`);
      }
      setScheduleRows(rows.map(({ rowNumber: _rowNumber, ...row }) => row));
      flash(`Loaded ${rows.length} schedule items. Save site content to publish them.`);
    } catch (e: any) {
      flash(`Could not read schedule: ${e.message}`, true);
    }
  };

  const addFeaturedWinner = () => {
    if (!winnerDraft.event.trim() || !winnerDraft.name.trim()) {
      flash("Enter the event and winner name", true);
      return;
    }
    setFeaturedWinners([
      ...featuredWinners,
      { ...winnerDraft, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ]);
    setWinnerDraft({ event: "", category: "Boys", name: "", house: "", result: "", participantReg: "" });
  };

  const saveSiteContent = async () => {
    try {
      await api("/admin/site-content", { liveDay, schedule: scheduleRows, featuredWinners }, pin);
      flash("Homepage live day, schedule, and winners saved ✓");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  // Unregister participant
  const unregisterStudent = async (id: string, name: string) => {
    if (!confirm(`Remove registration for ${name}?`)) return;
    try {
      const result = await api("/unregister/" + id, {}, pin);
      setSelectedRegistrationIds((current) => current.filter((selectedId) => selectedId !== id));
      flash(result.warnings?.length ? result.warnings.join("; ") : `Removed registration for ${name} ✓`, Boolean(result.warnings?.length));
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const unregisterSelectedStudents = async () => {
    if (!selectedRegistrationIds.length || !confirm(`Remove ${selectedRegistrationIds.length} selected registration${selectedRegistrationIds.length === 1 ? "" : "s"}?`)) return;
    try {
      const result = await api("/admin/unregister-bulk", { ids: selectedRegistrationIds }, pin);
      setSelectedRegistrationIds([]);
      flash(
        result.warnings?.length
          ? `Removed ${result.removed} registration(s). ${result.warnings.join("; ")}`
          : `Removed ${result.removed} registration(s) ✓`,
        Boolean(result.warnings?.length)
      );
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  // Database actions: Export JSON, Export SQL, and Reset to Sportsitem.txt
  const handleDownloadJson = async () => {
    try {
      const db = await api("/admin/db/export", undefined, pin);
      triggerFileDownload(JSON.stringify(db, null, 2), `sportsmeet-db-${Date.now()}.json`, "application/json");
      flash("Server database JSON exported ✓");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const handleDownloadSql = async () => {
    try {
      const sql = await api("/admin/db/export-sql", undefined, pin);
      triggerFileDownload(sql, `sportsmeet-postgres-migration-${Date.now()}.sql`, "text/plain");
      flash("PostgreSQL / Supabase migration SQL script exported ✓");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const csv = await api("/export.csv", undefined, pin);
      triggerFileDownload(csv, `sportsmeet-registrations-${Date.now()}.csv`, "text/csv");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const handleResetSportsitem = async () => {
    if (!confirm("Reset all events back to the 30 events defined in Sportsitem.txt? This will restore all standard items from the file.")) return;
    try {
      await api("/admin/reset-events", { clearRegistrations: false }, pin);
      flash("Events successfully restored from Sportsitem.txt ✓");
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  // Filter events for the currently active Category (Athletics/Games) and Gender (Boys/Girls)
  const currentEvents: EventItem[] = (cfg.events || []).filter(
    (e: EventItem) => e.category === activeCategory && e.gender === activeGender
  );

  const totalRegsCount = s.counts ? Number(Object.values(s.counts).reduce((a: any, b: any) => a + Number(b || 0), 0)) : 0;
  const winnerPhotoCandidates = [...new Map(
    (regs || [])
      .filter((registration) => registration.picture)
      .map((registration) => [registration.reg, registration])
  ).values()];
  const filteredRegistrations = (regs || []).filter((registration) => {
    const query = regSearch.trim().toLowerCase();
    return !query ||
      String(registration.reg || "").toLowerCase().includes(query) ||
      String(registration.name || "").toLowerCase().includes(query) ||
      String(registration.house || "").toLowerCase().includes(query);
  });
  const allVisibleRegistrationsSelected = filteredRegistrations.length > 0 &&
    filteredRegistrations.every((registration) => selectedRegistrationIds.includes(registration.id));
  const toggleVisibleRegistrations = () => {
    setSelectedRegistrationIds((current) => allVisibleRegistrationsSelected
      ? current.filter((id) => !filteredRegistrations.some((registration) => registration.id === id))
      : [...new Set([...current, ...filteredRegistrations.map((registration) => registration.id)])]
    );
  };
  const normalizedRegistrationNumber = registrationDraft.reg.trim().toUpperCase();
  const existingRegistrationRows = (regs || []).filter((registration) => registration.reg === normalizedRegistrationNumber);
  const existingRegistrationEvents = new Set(existingRegistrationRows.map((registration) => registration.eventId));
  const eventById = new Map<string, EventItem>();
  (cfg.events || []).forEach((event: EventItem) => eventById.set(event.id, event));
  const athleticsEventIds = (ids: string[]) => ids.filter((id) => {
    const event = eventById.get(id);
    return event?.category === "Athletics" && !isRelayEvent(event);
  });
  const registeredAthleticsEvents = athleticsEventIds(existingRegistrationRows.map((registration) => registration.eventId));
  const selectedIndividualAthleticsCount = new Set([
    ...registeredAthleticsEvents,
    ...athleticsEventIds(registrationDraft.eventIds),
  ]).size;
  const hasRelayRegistration = [...existingRegistrationEvents, ...registrationDraft.eventIds].some((id) => {
    const event = eventById.get(id);
    return event?.category === "Athletics" && isRelayEvent(event);
  });
  const visibleActivityLogs = activityLogs?.entries || [];

  return (
    <div className="card">
      {/* Top Header Bar */}
      <div className="flex-between" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "16px", marginBottom: "16px" }}>
        <div>
          <h2>Admin Control Desk</h2>
          <p className="muted">Configure categories, events, predefined points, manage results, and export database</p>
        </div>
        <div className="flex-gap">
          <a href="#/poster" className="btn sm" style={{ background: "var(--navy)" }}>
            🎨 Poster Studio
          </a>
          <button className="btn sm ghost" onClick={handleDownloadCsv}>
            📥 Export CSV
          </button>
          <button className="btn sm danger" onClick={handleLogout} title="Log out from admin desk">
            🚪 Logout
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`card ${msg.isError ? "err" : "ok"}`}
          style={{
            background: msg.isError ? "#fef2f2" : "#f0fdf4",
            padding: "10px 14px",
            marginBottom: "16px",
            borderColor: msg.isError ? "var(--red)" : "var(--green)",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="category-tabs" style={{ marginBottom: "20px" }}>
        <button
          className={`category-tab ${adminTab === "events" ? "active" : ""}`}
          onClick={() => setAdminTab("events")}
        >
          🏆 Events & Results ({cfg.events?.length || 0})
        </button>
        <button
          className={`category-tab ${adminTab === "points" ? "active" : ""}`}
          onClick={() => setAdminTab("points")}
        >
          ⚙️ Predefined Points
        </button>
        <button
          className={`category-tab ${adminTab === "teams" ? "active" : ""}`}
          onClick={() => setAdminTab("teams")}
        >
          🛡️ Teams / Houses ({currentTeams.length})
        </button>
        <button
          className={`category-tab ${adminTab === "captains" ? "active" : ""}`}
          onClick={() => setAdminTab("captains")}
        >
          🔐 House Captains
        </button>
        <button
          className={`category-tab ${adminTab === "gallery" ? "active" : ""}`}
          onClick={() => setAdminTab("gallery")}
        >
          📷 Gallery
        </button>
        <button
          className={`category-tab ${adminTab === "site" ? "active" : ""}`}
          onClick={() => setAdminTab("site")}
        >
          🖥️ Homepage Content
        </button>
        <button
          className={`category-tab ${adminTab === "regs" ? "active" : ""}`}
          onClick={() => setAdminTab("regs")}
        >
          👥 Registrations ({totalRegsCount})
        </button>
        <button
          className={`category-tab ${adminTab === "activity" ? "active" : ""}`}
          onClick={() => setAdminTab("activity")}
        >
          🧾 Activity Log
        </button>
        <button
          className={`category-tab ${adminTab === "db" ? "active" : ""}`}
          onClick={() => setAdminTab("db")}
        >
          💾 Database & Migration
        </button>
      </div>

      {adminTab === "site" && (
        <div>
          <h3>Homepage Content Controls</h3>
          <p className="muted" style={{ marginBottom: "18px" }}>
            Control the live-day label, public schedule, and featured Event Winners cards.
          </p>

          <div className="card" style={{ maxWidth: "620px" }}>
            <label>
              Live day / navbar label
              <input value={liveDay} onChange={(e) => setLiveDay(e.target.value)} placeholder="e.g. Day 1 · Finals" />
            </label>
          </div>

          <div className="card">
            <div className="flex-between">
              <div>
                <h3>Event Schedule ({scheduleRows.length})</h3>
                <p className="muted">Required columns: Day, Time, Event, Location. Category and Gender are optional.</p>
              </div>
              <div className="flex-gap">
                <button className="btn sm ghost" onClick={downloadScheduleCsvTemplate}>CSV Template</button>
                <button className="btn sm ghost" onClick={downloadScheduleExcelTemplate}>Excel Template</button>
              </div>
            </div>
            <label style={{ maxWidth: "520px", marginTop: "12px" }}>
              Upload CSV or Excel schedule
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => importSchedule(e.target.files?.[0])} />
            </label>
            {scheduleRows.length > 0 && (
              <div className="scroll">
                <table>
                  <thead>
                    <tr><th>Day</th><th>Time</th><th>Event</th><th>Category</th><th>Gender</th><th>Location</th></tr>
                  </thead>
                  <tbody>
                    {scheduleRows.slice(0, 12).map((item, index) => (
                      <tr key={`${item.day}-${item.time}-${index}`}>
                        <td>{item.day}</td><td>{item.time}</td><td>{item.event}</td><td>{item.category}</td><td>{item.gender}</td><td>{item.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {scheduleRows.length > 12 && <p className="muted">Showing the first 12 rows of {scheduleRows.length} schedule items.</p>}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Featured Event Winners ({featuredWinners.length})</h3>
            <p className="muted">Add or remove winner cards shown on the homepage. Leave this list empty to show winners published from Events & Results.</p>
            <div className="legacy-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <label>Event<input value={winnerDraft.event} onChange={(e) => setWinnerDraft({ ...winnerDraft, event: e.target.value })} /></label>
              <label>Division<select value={winnerDraft.category} onChange={(e) => setWinnerDraft({ ...winnerDraft, category: e.target.value })}><option>Boys</option><option>Girls</option><option>Mixed</option></select></label>
              <label>Winner / team<input value={winnerDraft.name} onChange={(e) => setWinnerDraft({ ...winnerDraft, name: e.target.value })} /></label>
              <label>House<input value={winnerDraft.house} onChange={(e) => setWinnerDraft({ ...winnerDraft, house: e.target.value })} /></label>
              <label>
                Link participant photo (optional)
                <select
                  value={winnerDraft.participantReg}
                  onChange={(e) => {
                    const participantReg = e.target.value;
                    const participant = winnerPhotoCandidates.find((candidate) => candidate.reg === participantReg);
                    setWinnerDraft((current) => ({
                      ...current,
                      participantReg,
                      ...(participant ? { name: participant.name, house: participant.house } : {}),
                    }));
                  }}
                >
                  <option value="">No linked participant</option>
                  {winnerPhotoCandidates.map((candidate) => (
                    <option key={candidate.reg} value={candidate.reg}>
                      {candidate.name} - {candidate.reg} - {candidate.house}
                    </option>
                  ))}
                </select>
              </label>
              <label>Result / record<input value={winnerDraft.result} onChange={(e) => setWinnerDraft({ ...winnerDraft, result: e.target.value })} placeholder="e.g. 10.82 s" /></label>
            </div>
            <button className="btn sm" onClick={addFeaturedWinner}>Add Winner Card</button>
            {featuredWinners.map((winner, index) => (
              <div className="row" key={winner.id} style={{ marginTop: "10px" }}>
                {winner.picture && <img src={winner.picture} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "50%" }} />}
                <span><strong>{winner.event}</strong> · {winner.name} · {winner.category} {winner.house && `· ${winner.house}`}</span>
                <button className="btn sm danger" onClick={() => setFeaturedWinners(featuredWinners.filter((_, i) => i !== index))}>Remove</button>
              </div>
            ))}
          </div>
          <button className="btn" onClick={saveSiteContent}>Save Homepage Content</button>
        </div>
      )}

      {/* ================= TAB 1: EVENTS & RESULTS ================= */}
      {adminTab === "events" && (
        <div>
          {/* Category Selector: Athletics vs Games */}
          <div className="category-tabs" style={{ background: "#f1f5f9", maxWidth: "480px" }}>
            <button
              className={`category-tab ${activeCategory === "Athletics" ? "active" : ""}`}
              onClick={() => setActiveCategory("Athletics")}
            >
              🏃 Athletics Events ({cfg.events?.filter((e: any) => e.category === "Athletics").length || 0})
            </button>
            <button
              className={`category-tab ${activeCategory === "Games" ? "active" : ""}`}
              onClick={() => setActiveCategory("Games")}
            >
              ⚽ Games Events ({cfg.events?.filter((e: any) => e.category === "Games").length || 0})
            </button>
          </div>

          {/* Subcategory Selector: Boys vs Girls */}
          <div className="flex-between" style={{ marginBottom: "16px" }}>
            <div className="sub-tabs" style={{ margin: 0 }}>
              <button
                className={`sub-tab ${activeGender === "Boys" ? "active" : ""}`}
                onClick={() => setActiveGender("Boys")}
              >
                👦 Boys ({cfg.events?.filter((e: any) => e.category === activeCategory && e.gender === "Boys").length || 0})
              </button>
              <button
                className={`sub-tab ${activeGender === "Girls" ? "active" : ""}`}
                onClick={() => setActiveGender("Girls")}
              >
                👧 Girls ({cfg.events?.filter((e: any) => e.category === activeCategory && e.gender === "Girls").length || 0})
              </button>
            </div>

            <div className="flex-gap">
              <button className="btn sm" onClick={openAddEvent}>
                ➕ Add {activeCategory} Event ({activeGender})
              </button>
            </div>
          </div>

          {/* Add / Edit Event Inline Form */}
          {isEditingEvent && (
            <div
              className="card"
              style={{
                background: "#f8fafc",
                borderColor: "var(--orange)",
                borderWidth: "2px",
                marginBottom: "20px",
              }}
            >
              <h3>{eventForm.id ? "Edit Event" : `Add New ${eventForm.category} Event (${eventForm.gender})`}</h3>
              <div className="legacy-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                <label>
                  Event Name
                  <input
                    placeholder="e.g. 100m, Football, Highjump"
                    value={eventForm.name}
                    onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={eventForm.category}
                    onChange={(e) => setEventForm({ ...eventForm, category: e.target.value as any })}
                  >
                    <option value="Athletics">Athletics</option>
                    <option value="Games">Games</option>
                  </select>
                </label>
                <label>
                  Section / Gender
                  <select
                    value={eventForm.gender}
                    onChange={(e) => setEventForm({ ...eventForm, gender: e.target.value as any })}
                  >
                    <option value="Boys">Boys</option>
                    <option value="Girls">Girls</option>
                  </select>
                </label>
                <label>
                  Event Type
                  <select
                    value={eventForm.type}
                    onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                  >
                    <option value="track">Track (Sprint / Race)</option>
                    <option value="field">Field (Jump / Throw)</option>
                    <option value="team">Team Game</option>
                    <option value="court">Court (Badminton / Chess / TT)</option>
                    <option value="judged">Judged (Performance / Score)</option>
                  </select>
                </label>
              </div>

              <div style={{ marginTop: "10px" }}>
                <label style={{ marginBottom: "6px" }}>Predefined Points for this Event (1st, 2nd, 3rd Place):</label>
                <div className="points-inputs" style={{ maxWidth: "340px" }}>
                  <div>
                    <span className="muted">🥇 1st:</span>
                    <input
                      type="number"
                      value={eventForm.p1}
                      onChange={(e) => setEventForm({ ...eventForm, p1: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <span className="muted">🥈 2nd:</span>
                    <input
                      type="number"
                      value={eventForm.p2}
                      onChange={(e) => setEventForm({ ...eventForm, p2: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <span className="muted">🥉 3rd:</span>
                    <input
                      type="number"
                      value={eventForm.p3}
                      onChange={(e) => setEventForm({ ...eventForm, p3: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-gap" style={{ marginTop: "16px" }}>
                <button className="btn sm" onClick={saveEvent}>
                  Save Event
                </button>
                <button className="btn sm ghost" onClick={() => setIsEditingEvent(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List of Events in this Category & Gender */}
          {currentEvents.length === 0 ? (
            <div className="card" style={{ padding: "32px 16px", textAlign: "center", background: "#f8fafc" }}>
              <p className="muted" style={{ margin: 0 }}>
                No {activeCategory} events found for {activeGender}. Click "Add {activeCategory} Event" or reset to file data under Database & Migration tab.
              </p>
            </div>
          ) : (
            currentEvents.map((e) => {
              const teamEvent = e.category === "Games" || isRelayEvent(e);
              const eventRegs = (regs || []).filter((registration) => registration.eventId === e.id);
              const count = teamEvent
                ? new Set(eventRegs.map((registration) => registration.house)).size
                : new Set(eventRegs.map((registration) => registration.reg)).size;
              const result = s.results[e.id];
              const submission = judgeSubmissions?.[e.id];
              const pts = e.points || (e.category === "Games" ? [pointsState.game1, pointsState.game2, pointsState.game3] : [pointsState.ath1, pointsState.ath2, pointsState.ath3]);

              return (
                <div className="row" key={e.id} style={{ alignItems: "flex-start", padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ flex: "1 1 240px" }}>
                    <div className="flex-gap" style={{ marginBottom: "4px" }}>
                      <strong>{e.name}</strong>
                      <span className="badge navy">{e.type}</span>
                      <span className="badge orange">
                        {pts[0]}-{pts[1]}-{pts[2]} pts
                      </span>
                      {result && <span className="badge green">✅ Published</span>}
                    </div>
                    <span className="muted">
                      {count} {teamEvent ? (count === 1 ? "team" : "teams") : (count === 1 ? "participant" : "participants")} registered
                    </span>

                    {submission && !result && (
                      <div className="card" style={{ marginTop: "8px", padding: "8px 12px", background: "#f0fdf4" }}>
                        <strong className="ok">Judge results ready to publish</strong>
                        <div className="muted">Submitted by {submission.judge} · {submission.positions.length} {teamEvent ? "teams" : "participants"} ranked</div>
                        {submission.positions.slice(0, 3).map((place: any, index: number) => {
                          const participant = eventRegs.find((registration) => registration.reg === place.reg);
                          const label = teamEvent ? `${place.reg} Team` : participant?.name || place.reg;
                          return <div key={place.reg}>{["🥇 1st", "🥈 2nd", "🥉 3rd"][index]}: <strong>{label}</strong></div>;
                        })}
                      </div>
                    )}

                    {/* Published Winner Details */}
                    {result && (
                      <div style={{ marginTop: "8px", fontSize: "0.85rem", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px" }}>
                        <div style={{ fontWeight: 600, color: "var(--navy)" }}>Podium Winners:</div>
                        {result.places.map((p: any, idx: number) => (
                          <div key={idx}>
                            {["🥇 1st", "🥈 2nd", "🥉 3rd"][idx]}: <strong>{teamEvent ? `${p.house} Team` : `${p.name} (${p.house})`}</strong> — <span className="muted">+{pts[idx]} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Podium Input & Publish Actions */}
                  <div className="flex-gap" style={{ alignItems: "center" }}>
                    {!result ? (
                      submission ? (
                        <button className="btn sm success" onClick={() => publishJudgeResults(e.id)}>
                          Publish Judge Results
                        </button>
                      ) : (
                        <>
                          <input
                            placeholder={`1st, 2nd, 3rd (${teamEvent ? "House names" : "Reg Nos"})`}
                            value={manual[e.id] || ""}
                            onChange={(x) => setManual({ ...manual, [e.id]: x.target.value })}
                            style={{ width: "190px" }}
                            aria-label={`Enter winners for ${e.name}`}
                          />
                          <button className="btn sm" onClick={() => publishPlaces(e.id)}>
                            Publish Manually
                          </button>
                        </>
                    )) : (
                      <>
                        <button className="btn sm ghost" onClick={() => unpublishEvent(e.id)}>
                          Undo
                        </button>
                        <a href="#/poster" className="btn sm ghost" title="Create social poster for this event">
                          🎨 Poster
                        </a>
                      </>
                    )}
                    <button className="btn sm ghost" onClick={() => openEditEvent(e)} title="Edit event and points">
                      ✏️ Edit
                    </button>
                    <button className="btn sm danger" onClick={() => deleteEvent(e.id, e.name)} title="Delete event">
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================= TAB 2: PREDEFINED POINTS ================= */}
      {adminTab === "points" && (
        <div style={{ maxWidth: "600px" }}>
          <h3>Predefined Points Configuration</h3>
          <p className="muted" style={{ marginBottom: "20px" }}>
            Assign default points awarded for 1st, 2nd, and 3rd place across <strong>Athletics</strong> (5, 3, 1) and <strong>Games</strong> (10, 5, 2). Individual events can also override these defaults. Changes are automatically saved to the local database.
          </p>

          <div className="card" style={{ background: "#f8fafc" }}>
            <h4>🏃 Athletics Default Points</h4>
            <div className="points-inputs" style={{ marginTop: "10px", marginBottom: "16px" }}>
              <label>
                🥇 1st Place (Gold)
                <input
                  type="number"
                  value={pointsState.ath1}
                  onChange={(e) => setPointsForm({ ...pointsState, ath1: Number(e.target.value) })}
                />
              </label>
              <label>
                🥈 2nd Place (Silver)
                <input
                  type="number"
                  value={pointsState.ath2}
                  onChange={(e) => setPointsForm({ ...pointsState, ath2: Number(e.target.value) })}
                />
              </label>
              <label>
                🥉 3rd Place (Bronze)
                <input
                  type="number"
                  value={pointsState.ath3}
                  onChange={(e) => setPointsForm({ ...pointsState, ath3: Number(e.target.value) })}
                />
              </label>
            </div>

            <h4>⚽ Games Default Points</h4>
            <div className="points-inputs" style={{ marginTop: "10px" }}>
              <label>
                🥇 1st Place (Winner)
                <input
                  type="number"
                  value={pointsState.game1}
                  onChange={(e) => setPointsForm({ ...pointsState, game1: Number(e.target.value) })}
                />
              </label>
              <label>
                🥈 2nd Place (Runner-up)
                <input
                  type="number"
                  value={pointsState.game2}
                  onChange={(e) => setPointsForm({ ...pointsState, game2: Number(e.target.value) })}
                />
              </label>
              <label>
                🥉 3rd Place (Third)
                <input
                  type="number"
                  value={pointsState.game3}
                  onChange={(e) => setPointsForm({ ...pointsState, game3: Number(e.target.value) })}
                />
              </label>
            </div>

            <button className="btn" onClick={savePointsConfig} style={{ marginTop: "20px" }}>
              Save Predefined Points to Local Database
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 3: TEAMS / HOUSES ================= */}
      {adminTab === "teams" && (
        <div style={{ maxWidth: "600px" }}>
          <h3>Team / House Management</h3>
          <p className="muted" style={{ marginBottom: "16px" }}>
            Rename existing teams or create new ones for this sports meet. All registrations and points calculations will reflect these names immediately.
          </p>

          <div className="card" style={{ background: "#f8fafc" }}>
            <label style={{ marginBottom: "10px" }}>Active Tournament Teams ({currentTeams.length})</label>
            {currentTeams.map((team, idx) => (
              <div className="team-item" key={idx}>
                <span className="badge navy" style={{ width: "30px", justifyContent: "center" }}>
                  {idx + 1}
                </span>
                <input
                  value={team}
                  onChange={(e) => handleRenameTeam(idx, e.target.value)}
                  placeholder="Team Name"
                  style={{ margin: 0 }}
                />
                <button
                  className="btn sm danger"
                  onClick={() => handleRemoveTeam(idx)}
                  title="Remove team"
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="flex-gap" style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
              <input
                placeholder="New team name (e.g. Phoenix, Warriors)"
                value={newTeamInput}
                onChange={(e) => setNewTeamInput(e.target.value)}
                style={{ margin: 0, flex: 1 }}
                onKeyDown={(e) => e.key === "Enter" && handleAddTeam()}
              />
              <button className="btn sm" onClick={handleAddTeam}>
                ➕ Add Team
              </button>
            </div>

            <button className="btn" onClick={saveTeamsConfig} style={{ marginTop: "20px" }}>
              Save Teams to Local Database
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB: HOUSE CAPTAIN CREDENTIALS ================= */}
      {adminTab === "captains" && (
        <div>
          <h3>House Captain Credentials</h3>
          <p className="muted" style={{ marginBottom: "16px" }}>
            Generate one login for each house. Captains can only register participants for their assigned house.
          </p>
          <button className="btn sm" onClick={generateCaptainCredentials} style={{ marginBottom: "16px" }}>
            Generate Credentials
          </button>
          {currentCaptains.map((captain: any, idx: number) => (
            <div className="card" key={captain.house} style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label>House<input value={captain.house} onChange={(e) => setCaptainsList(currentCaptains.map((c: any, i: number) => i === idx ? { ...c, house: e.target.value } : c))} /></label>
              <label>Captain name<input value={captain.name || ""} onChange={(e) => setCaptainsList(currentCaptains.map((c: any, i: number) => i === idx ? { ...c, name: e.target.value } : c))} /></label>
              <label>Username<input value={captain.username} onChange={(e) => setCaptainsList(currentCaptains.map((c: any, i: number) => i === idx ? { ...c, username: e.target.value } : c))} /></label>
              <label>Password<input value={captain.password} onChange={(e) => setCaptainsList(currentCaptains.map((c: any, i: number) => i === idx ? { ...c, password: e.target.value } : c))} /></label>
            </div>
          ))}
          {currentCaptains.length > 0 && <button className="btn" onClick={saveCaptainCredentials}>Save Captain Credentials</button>}
        </div>
      )}

      {/* ================= TAB: EVENT GALLERY ================= */}
      {adminTab === "gallery" && (
        <div>
          <h3>Event Gallery</h3>
          <p className="muted" style={{ marginBottom: "16px" }}>Upload photos as the event continues. Published photos appear immediately in the public Meet Gallery.</p>
          <div className="card" style={{ maxWidth: "620px" }}>
            <label>Photo caption<input value={galleryCaption} onChange={(e) => setGalleryCaption(e.target.value)} placeholder="e.g. 100m Boys Final" /></label>
            <label>Choose photo<input type="file" accept="image/*" onChange={(e) => uploadGalleryPhoto(e.target.files?.[0])} /></label>
          </div>
          <div className="legacy-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {(cfg.gallery || []).map((item: any) => (
              <div className="card" key={item.id} style={{ padding: "8px" }}>
                <img src={item.src} alt={item.caption || "Sports meet photo"} style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "8px" }} />
                <p className="muted" style={{ margin: "8px 4px" }}>{item.caption || "Sports Meet"}</p>
                <button className="btn sm danger" onClick={() => removeGalleryPhoto(item.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 4: REGISTRATIONS ================= */}
      {adminTab === "regs" && (
        <div>
          <div className="card">
            <h3>Add a Registration</h3>
            <p className="muted" style={{ marginBottom: "16px" }}>
              Admins can add participants directly. Each house may enter 3 people in each individual Athletics event and 4 in each relay. A student may enter 3 individual Athletics events plus one relay; Games have no student cap.
            </p>
            <p className="muted">All students from a house registered for the same Games item form that house’s single team roster.</p>
            {existingRegistrationRows.length > 0 && (
              <p className="muted">
                Existing participant: {existingRegistrationRows[0].name} · {existingRegistrationRows[0].house} · {existingRegistrationRows[0].gender}. The saved photo can be reused.
              </p>
            )}
            <div className="legacy-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label>
                Register number
                <input
                  value={registrationDraft.reg}
                  onChange={(e) => setRegistrationDraft((current) => ({
                    ...current,
                    reg: e.target.value,
                    eventIds: current.reg.trim().toUpperCase() === e.target.value.trim().toUpperCase() ? current.eventIds : [],
                  }))}
                  onBlur={() => {
                    if (!existingRegistrationRows.length) return;
                    const participant = existingRegistrationRows[0];
                    setRegistrationDraft((current) => ({
                      ...current,
                      name: participant.name,
                      house: participant.house,
                      gender: participant.gender,
                      picture: current.picture || participant.picture || "",
                      eventIds: current.eventIds.filter((eventId) => !existingRegistrationEvents.has(eventId)),
                    }));
                  }}
                />
              </label>
              <label>
                Full name
                <input value={registrationDraft.name} onChange={(e) => setRegistrationDraft({ ...registrationDraft, name: e.target.value })} />
              </label>
              <label>
                House
                <select value={registrationDraft.house} onChange={(e) => setRegistrationDraft({ ...registrationDraft, house: e.target.value })}>
                  <option value="">Select house…</option>
                  {(cfg.houses || []).map((house: string) => <option key={house} value={house}>{house}</option>)}
                </select>
              </label>
              <label>
                Division
                <select value={registrationDraft.gender} onChange={(e) => setRegistrationDraft({ ...registrationDraft, gender: e.target.value, eventIds: [] })}>
                  <option value="">Select division…</option>
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                </select>
              </label>
              <label>
                Participant picture
                <input type="file" accept="image/*" onChange={(e) => readRegistrationPicture(e.target.files?.[0])} />
              </label>
            </div>
            {registrationDraft.picture && (
              <img src={registrationDraft.picture} alt="Participant preview" style={{ width: "96px", height: "96px", objectFit: "cover", borderRadius: "12px", marginBottom: "14px" }} />
            )}
            {registrationDraft.gender && (
              <>
                <h4>Individual Athletics {selectedIndividualAthleticsCount}/3 · Relay {hasRelayRegistration ? 1 : 0}/1 · Games unlimited</h4>
                <div className="chips">
                  {(cfg.events || []).filter((event: EventItem) => event.gender === registrationDraft.gender).map((event: EventItem) => {
                    const selected = registrationDraft.eventIds.includes(event.id);
                    const alreadyRegistered = existingRegistrationEvents.has(event.id);
                    const relay = event.category === "Athletics" && isRelayEvent(event);
                    const individualLimitReached = event.category === "Athletics" && !relay && selectedIndividualAthleticsCount >= 3;
                    const relayLimitReached = relay && hasRelayRegistration;
                    const houseEntrants = new Set((regs || [])
                      .filter((registration) => registration.eventId === event.id && registration.house === registrationDraft.house)
                      .map((registration) => registration.reg.trim().toUpperCase()));
                    const houseLimitReached = event.category === "Athletics" && Boolean(registrationDraft.house) &&
                      houseEntrants.size >= (relay ? 4 : 3);
                    const eventPublished = Boolean(s.results[event.id]);
                    const disabled = !selected && (
                      alreadyRegistered || individualLimitReached || relayLimitReached || houseLimitReached || eventPublished
                    );
                    return (
                      <button
                        type="button"
                        key={event.id}
                        className={"chip" + (selected ? " on" : "")}
                        disabled={disabled}
                        onClick={() => setRegistrationDraft((current) => ({
                          ...current,
                          eventIds: selected
                            ? current.eventIds.filter((id) => id !== event.id)
                            : [...current.eventIds, event.id],
                        }))}
                        style={{ opacity: disabled ? 0.55 : 1 }}
                        title={
                          alreadyRegistered ? "Already registered for this event" :
                          houseLimitReached ? "House limit reached for this Athletics event" :
                          eventPublished ? "Unpublish this event before changing registrations" :
                          individualLimitReached || relayLimitReached ? "Participant event limit reached" : undefined
                        }
                      >
                        {event.name}<small>{event.category}</small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <button type="button" className="btn" onClick={addAdminRegistration}>Add Participant</button>
          </div>

          <div className="flex-between" style={{ marginBottom: "16px" }}>
            <h3>Registered Participants ({totalRegsCount})</h3>
            <input
              placeholder="🔍 Search student name, reg number, house..."
              value={regSearch}
              onChange={(e) => setRegSearch(e.target.value)}
              style={{ maxWidth: "300px", margin: 0 }}
            />
          </div>

          <div className="flex-between" style={{ marginBottom: "12px" }}>
            <span className="muted">{selectedRegistrationIds.length} registration(s) selected</span>
            <div className="flex-gap">
              <button className="btn sm ghost" onClick={toggleVisibleRegistrations} disabled={!filteredRegistrations.length}>
                {allVisibleRegistrationsSelected ? "Unselect visible" : "Select visible"}
              </button>
              <button className="btn sm danger" onClick={() => void unregisterSelectedStudents()} disabled={!selectedRegistrationIds.length}>
                Remove selected
              </button>
            </div>
          </div>

          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="Select visible registrations" checked={allVisibleRegistrationsSelected} onChange={toggleVisibleRegistrations} disabled={!filteredRegistrations.length} /></th>
                  <th>Photo</th>
                  <th>Reg No</th>
                  <th>Student Name</th>
                  <th>Team / House</th>
                  <th>Gender</th>
                  <th>Category</th>
                  <th>Event</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(!regs || regs.length === 0) && (
                  <tr>
                    <td colSpan={9} className="muted" style={{ textAlign: "center", padding: "20px" }}>
                      No registrations found. Add one above or ask a house captain to register participants.
                    </td>
                  </tr>
                )}
                {regs && regs.length > 0 && filteredRegistrations.length === 0 && (
                  <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: "20px" }}>No registrations match this search.</td></tr>
                )}
                {filteredRegistrations.map((r) => {
                    const ev = cfg.events?.find((e: any) => e.id === r.eventId);
                    return (
                      <tr key={r.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.name} registration for ${ev?.name || r.eventId}`}
                            checked={selectedRegistrationIds.includes(r.id)}
                            onChange={(event) => setSelectedRegistrationIds((current) =>
                              event.target.checked
                                ? [...current, r.id]
                                : current.filter((id) => id !== r.id)
                            )}
                          />
                        </td>
                        <td>
                          {r.picture ? <img src={r.picture} alt={r.name} style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "50%" }} /> : <span className="muted">—</span>}
                        </td>
                        <td>
                          <strong>{r.reg}</strong>
                        </td>
                        <td>{r.name}</td>
                        <td>
                          <span className="badge navy">{r.house}</span>
                        </td>
                        <td>{r.gender}</td>
                        <td>
                          <span className="badge orange">{ev?.category || "General"}</span>
                        </td>
                        <td>{ev?.name || r.eventId}</td>
                        <td>
                          <button
                            className="btn sm danger"
                            onClick={() => unregisterStudent(r.id, r.name)}
                            title="Unregister student"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 5: DATABASE & MIGRATION ================= */}
      {adminTab === "db" && (
        <div style={{ maxWidth: "700px" }}>
          <h3>Database Persistence & Cloud Migration</h3>
          <p className="muted" style={{ marginBottom: "18px" }}>
            The Express API currently persists data in its server-side JSON database. SQL exports include the schema and eligible records, but omit legacy captain passwords and base64 images. Review exports carefully and run them only in a new Supabase project.
          </p>

          {/* Status Box */}
          <div className="card" style={{ background: "#f8fafc", marginBottom: "20px" }}>
            <h4>📊 Current Server Database Status</h4>
            <div className="legacy-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginTop: "12px" }}>
              <div style={{ background: "#fff", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <span className="muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Events</span>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--navy)" }}>{cfg.events?.length || 0}</div>
              </div>
              <div style={{ background: "#fff", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <span className="muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Teams / Houses</span>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--navy)" }}>{currentTeams.length}</div>
              </div>
              <div style={{ background: "#fff", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <span className="muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Registrations</span>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--navy)" }}>{totalRegsCount}</div>
              </div>
              <div style={{ background: "#fff", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <span className="muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Published Podiums</span>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--navy)" }}>{s.published || 0}</div>
              </div>
            </div>
          </div>

          {/* Migration Tools */}
          <div className="card" style={{ marginBottom: "20px" }}>
            <h4>🚀 Export & Cloud Hosting Migration</h4>
            <p className="muted" style={{ marginTop: "4px", marginBottom: "16px" }}>
              Migrate your current tournament data to Supabase (free serverless PostgreSQL), Neon, or any relational database.
            </p>

            <div className="flex-gap" style={{ marginBottom: "16px" }}>
              <button className="btn sm" onClick={handleDownloadSql} style={{ background: "var(--navy)" }}>
                🐘 Download Supabase / PostgreSQL SQL (.sql)
              </button>
              <button className="btn sm ghost" onClick={handleDownloadJson}>
                💾 Download Full Database JSON (.json)
              </button>
            </div>

            <div style={{ background: "#f1f5f9", padding: "12px 16px", borderRadius: "8px", fontSize: "0.85rem" }}>
              <strong>How to migrate to Supabase in 3 steps:</strong>
              <ol style={{ paddingLeft: "20px", marginTop: "6px", marginBottom: 0, lineHeight: 1.6 }}>
                <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: "var(--orange)", fontWeight: 600 }}>supabase.com</a>.</li>
                <li>Open the downloaded <code>.sql</code> file in the Supabase <strong>SQL Editor</strong> and review it.</li>
                <li>Run it only in a new/empty project. Captain credentials must be reset and securely hashed separately.</li>
              </ol>
            </div>
          </div>

          {/* Reset Tool */}
          <div className="card" style={{ borderColor: "#fed7aa" }}>
            <h4 style={{ color: "#9a3412" }}>🔄 Reset Items to Sportsitem.txt</h4>
            <p className="muted" style={{ marginTop: "4px", marginBottom: "12px" }}>
              Restores the default 30 events (5 Boys Games, 5 Girls Games, 10 Boys Athletics, 10 Girls Athletics) and points scheme (Athletics: 5/3/1, Games: 10/5/2) as defined in <code>Sportsitem.txt</code>.
            </p>
            <button className="btn sm ghost" onClick={handleResetSportsitem} style={{ borderColor: "var(--orange)", color: "var(--orange)" }}>
              Restore from Sportsitem.txt
            </button>
          </div>
        </div>
      )}

      {adminTab === "activity" && (
        <div>
          <div className="flex-between" style={{ gap: "16px", marginBottom: "12px" }}>
            <div>
              <h3>Activity Log</h3>
              <p className="muted">
                Student entries identify the register number searched, not the person who made the public lookup. Gallery visitors are anonymous.
              </p>
            </div>
            <label style={{ minWidth: "180px", margin: 0 }}>
              Filter by actor
              <select
                value={activityFilter}
                onChange={(event) => {
                  setActivityFilter(event.target.value);
                  setActivityPage(0);
                }}
              >
                <option value="all">Everyone</option>
                <option value="admin">Admin</option>
                <option value="judge">Judge</option>
                <option value="captain">House captains</option>
                <option value="media_team">Media Team</option>
                <option value="student_lookup">Points lookups</option>
                <option value="gallery_visitor">Gallery visitors</option>
              </select>
            </label>
          </div>
          {activityLogs === null ? (
            <p className="muted" role="status">Loading activity records…</p>
          ) : (
            <>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Actor</th>
                      <th>Activity</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleActivityLogs.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.at ? new Date(entry.at).toLocaleString() : "—"}</td>
                        <td>
                          <strong>{entry.name || entry.type}</strong>
                          <div className="muted">{String(entry.type || "").replace(/_/g, " ")}</div>
                        </td>
                        <td>{String(entry.action || "").replace(/_/g, " ")}</td>
                        <td>{entry.summary || entry.entityId || "—"}</td>
                      </tr>
                    ))}
                    {visibleActivityLogs.length === 0 && (
                      <tr><td colSpan={4}>No matching activity records yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex-between" style={{ marginTop: "12px" }}>
                <span className="muted">
                  {activityLogs.total === 0 ? 0 : activityPage * 100 + 1}–{Math.min((activityPage + 1) * 100, activityLogs.total)} of {activityLogs.total}
                </span>
                <div className="flex-gap">
                  <button className="btn sm ghost" disabled={activityPage === 0} onClick={() => setActivityPage((page) => page - 1)}>
                    Previous
                  </button>
                  <button className="btn sm ghost" disabled={(activityPage + 1) * 100 >= activityLogs.total} onClick={() => setActivityPage((page) => page + 1)}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  return (
    <PinGate role="admin">
      {(pin) => <Panel pin={pin} />}
    </PinGate>
  );
}
