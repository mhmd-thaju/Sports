import { useState } from "react";
import { api } from "../api";
import { usePoll } from "../hooks";
import PinGate from "../components/PinGate";

interface EventItem {
  id: string;
  name: string;
  category: "Athletics" | "Games";
  gender: "Boys" | "Girls";
  type: string;
  points?: number[];
}

function Panel({ pin }: { pin: string }) {
  const cfg = usePoll("/config", 10000);
  const s = usePoll("/state", 4000);
  const regs = usePoll<any[]>("/regs", 10000);

  // Active top-level tab
  const [adminTab, setAdminTab] = useState<"events" | "points" | "teams" | "regs">("events");

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

  // Search filter for registrations
  const [regSearch, setRegSearch] = useState("");

  if (!cfg || !s) return <p className="muted">Loading tournament data…</p>;

  // Initialize points form from live config if not edited
  const currentCategoryPoints = cfg.categoryPoints || { Athletics: [5, 3, 1], Games: [10, 6, 2] };
  const pointsState = pointsForm || {
    ath1: currentCategoryPoints.Athletics?.[0] ?? 5,
    ath2: currentCategoryPoints.Athletics?.[1] ?? 3,
    ath3: currentCategoryPoints.Athletics?.[2] ?? 1,
    game1: currentCategoryPoints.Games?.[0] ?? 10,
    game2: currentCategoryPoints.Games?.[1] ?? 6,
    game3: currentCategoryPoints.Games?.[2] ?? 2,
  };

  // Initialize teams list from live config if not edited
  const currentTeams = teamsList || (cfg.houses as string[]) || [];

  const flash = (text: string, isError = false) => {
    setMsg({ text, isError });
    setTimeout(() => setMsg(null), 5000);
  };

  // Publish / Unpublish results
  const publishPlaces = (eid: string) => {
    const raw = manual[eid];
    const places = raw ? raw.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
    api("/publish/" + eid, { places }, pin)
      .then(() => flash("Podium published successfully ✓"))
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
      p2: pts[1] ?? 3,
      p3: pts[2] ?? 1,
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

  const deleteEvent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete event "${name}"? Any published results and registrations for it will be removed.`)) return;
    try {
      await api("/admin/event/" + id, {}, pin, undefined);
      // Fallback method for delete if needed
      flash(`Event "${name}" deleted ✓`);
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

  // Unregister participant
  const unregisterStudent = async (id: string, name: string) => {
    if (!confirm(`Remove registration for ${name}?`)) return;
    try {
      await api("/unregister/" + id, {}, pin);
      flash(`Removed registration for ${name} ✓`);
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  // Filter events for the currently active Category (Athletics/Games) and Gender (Boys/Girls)
  const currentEvents: EventItem[] = (cfg.events || []).filter(
    (e: EventItem) => e.category === activeCategory && e.gender === activeGender
  );

  return (
    <div className="card">
      {/* Top Header Bar */}
      <div className="flex-between" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "16px", marginBottom: "16px" }}>
        <div>
          <h2>Admin Control Desk</h2>
          <p className="muted">Configure categories, events, predefined points, and manage live meet results</p>
        </div>
        <div className="flex-gap">
          <a href="#/poster" className="btn sm" style={{ background: "var(--navy)" }}>
            🎨 Victory Poster Studio
          </a>
          <a className="btn sm ghost" href={"/api/export.csv?pin=" + encodeURIComponent(pin)}>
            📥 Export CSV
          </a>
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
          🏆 Events & Results
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
          🛡️ Teams / Houses
        </button>
        <button
          className={`category-tab ${adminTab === "regs" ? "active" : ""}`}
          onClick={() => setAdminTab("regs")}
        >
          👥 Registrations ({s.counts ? Object.values(s.counts).reduce((a: any, b: any) => a + b, 0) : 0})
        </button>
      </div>

      {/* ================= TAB 1: EVENTS & RESULTS ================= */}
      {adminTab === "events" && (
        <div>
          {/* Category Selector: Athletics vs Games */}
          <div className="category-tabs" style={{ background: "#f1f5f9", maxWidth: "480px" }}>
            <button
              className={`category-tab ${activeCategory === "Athletics" ? "active" : ""}`}
              onClick={() => setActiveCategory("Athletics")}
            >
              🏃 Athletics Events
            </button>
            <button
              className={`category-tab ${activeCategory === "Games" ? "active" : ""}`}
              onClick={() => setActiveCategory("Games")}
            >
              ⚽ Games Events
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

            <button className="btn sm" onClick={openAddEvent}>
              ➕ Add {activeCategory} Event ({activeGender})
            </button>
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
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                <label>
                  Event Name
                  <input
                    placeholder="e.g. 100m Sprint, Football, High Jump"
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
                    <option value="court">Court (Badminton / TT)</option>
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
            <p className="muted" style={{ padding: "24px 0", textAlign: "center" }}>
              No {activeCategory} events configured for {activeGender} yet. Click "Add Event" to create one.
            </p>
          ) : (
            currentEvents.map((e) => {
              const count = s.counts[e.id] || 0;
              const result = s.results[e.id];
              const pts = e.points || (e.category === "Games" ? [pointsState.game1, pointsState.game2, pointsState.game3] : [pointsState.ath1, pointsState.ath2, pointsState.ath3]);

              return (
                <div className="row" key={e.id} style={{ alignItems: "flex-start", padding: "16px 0" }}>
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
                      {count} student {count === 1 ? "entry" : "entries"} registered
                    </span>

                    {/* Published Winner Details */}
                    {result && (
                      <div style={{ marginTop: "8px", fontSize: "0.85rem", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px" }}>
                        <div style={{ fontWeight: 600, color: "var(--navy)" }}>Podium Winners:</div>
                        {result.places.map((p: any, idx: number) => (
                          <div key={idx}>
                            {["🥇 1st", "🥈 2nd", "🥉 3rd"][idx]}: <strong>{p.name}</strong> ({p.house}) — <span className="muted">+{pts[idx]} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Podium Input & Publish Actions */}
                  <div className="flex-gap" style={{ alignItems: "center" }}>
                    {!result ? (
                      <>
                        <input
                          placeholder="1st, 2nd, 3rd (Reg Nos)"
                          value={manual[e.id] || ""}
                          onChange={(x) => setManual({ ...manual, [e.id]: x.target.value })}
                          style={{ width: "190px" }}
                          aria-label={`Enter winners for ${e.name}`}
                        />
                        <button className="btn sm" onClick={() => publishPlaces(e.id)}>
                          Publish
                        </button>
                      </>
                    ) : (
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
            Assign default points awarded for 1st, 2nd, and 3rd place across <strong>Games</strong> and <strong>Athletics</strong>. Individual events can also override these defaults. Changes are stored in the local database.
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

      {/* ================= TAB 4: REGISTRATIONS ================= */}
      {adminTab === "regs" && (
        <div>
          <div className="flex-between" style={{ marginBottom: "16px" }}>
            <h3>Registered Participants</h3>
            <input
              placeholder="🔍 Search student name, reg number, house..."
              value={regSearch}
              onChange={(e) => setRegSearch(e.target.value)}
              style={{ maxWidth: "300px", margin: 0 }}
            />
          </div>

          <div className="scroll">
            <table>
              <thead>
                <tr>
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
                    <td colSpan={7} className="muted" style={{ textAlign: "center", padding: "20px" }}>
                      No registrations found.
                    </td>
                  </tr>
                )}
                {(regs || [])
                  .filter((r) => {
                    const q = regSearch.toLowerCase();
                    return (
                      !q ||
                      r.reg.toLowerCase().includes(q) ||
                      r.name.toLowerCase().includes(q) ||
                      r.house.toLowerCase().includes(q)
                    );
                  })
                  .map((r) => {
                    const ev = cfg.events?.find((e: any) => e.id === r.eventId);
                    return (
                      <tr key={r.id}>
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
