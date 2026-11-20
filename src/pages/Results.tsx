import { useState } from "react";
import { usePoll } from "../hooks";

export default function Results() {
  const s = usePoll("/state", 4000);
  const cfg = usePoll("/config", 30000);

  const [categoryFilter, setCategoryFilter] = useState<"All" | "Athletics" | "Games">("All");
  const [genderFilter, setGenderFilter] = useState<"All" | "Boys" | "Girls">("All");

  if (!s || !cfg) return <p className="muted">Loading live results…</p>;

  const medal = ["🥇 1st", "🥈 2nd", "🥉 3rd"];

  const filteredEvents = (cfg.events || []).filter((e: any) => {
    const matchCat = categoryFilter === "All" || e.category === categoryFilter;
    const matchGen =
      genderFilter === "All" ||
      e.gender === genderFilter ||
      (genderFilter === "Boys" && e.gender === "Men") ||
      (genderFilter === "Girls" && e.gender === "Women");
    return matchCat && matchGen;
  });

  return (
    <>
      <div className="flex-between" style={{ marginBottom: "16px" }}>
        <h2>
          <span className="live" /> Live Results & Standings
        </h2>
        <span className="muted">Auto-refreshes every 4s</span>
      </div>

      {/* House Point Table */}
      <div className="card">
        <h3>House Standings</h3>
        <p className="muted" style={{ marginBottom: "12px" }}>
          Calculated automatically from Athletics & Games predefined points.
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team / House</th>
                <th>Gold 🥇</th>
                <th>Silver 🥈</th>
                <th>Bronze 🥉</th>
                <th>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {s.standings.map((h: any, i: number) => (
                <tr key={h.house} style={{ fontWeight: i === 0 ? "700" : "normal" }}>
                  <td>
                    {i === 0 ? "🏆 1" : i + 1}
                  </td>
                  <td>
                    <span className="badge navy" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                      {h.house}
                    </span>
                  </td>
                  <td>{h.gold}</td>
                  <td>{h.silver}</td>
                  <td>{h.bronze}</td>
                  <td>
                    <b style={{ color: "var(--navy)", fontSize: "1.05rem" }}>{h.points}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category & Gender Filtering for Events */}
      <div className="card" style={{ padding: "16px" }}>
        <div className="flex-between">
          <div className="category-tabs" style={{ margin: 0, minWidth: "280px" }}>
            <button
              className={`category-tab ${categoryFilter === "All" ? "active" : ""}`}
              onClick={() => setCategoryFilter("All")}
            >
              All Events
            </button>
            <button
              className={`category-tab ${categoryFilter === "Athletics" ? "active" : ""}`}
              onClick={() => setCategoryFilter("Athletics")}
            >
              🏃 Athletics
            </button>
            <button
              className={`category-tab ${categoryFilter === "Games" ? "active" : ""}`}
              onClick={() => setCategoryFilter("Games")}
            >
              ⚽ Games
            </button>
          </div>

          <div className="sub-tabs" style={{ margin: 0 }}>
            <button
              className={`sub-tab ${genderFilter === "All" ? "active" : ""}`}
              onClick={() => setGenderFilter("All")}
            >
              All Genders
            </button>
            <button
              className={`sub-tab ${genderFilter === "Boys" ? "active" : ""}`}
              onClick={() => setGenderFilter("Boys")}
            >
              👦 Boys
            </button>
            <button
              className={`sub-tab ${genderFilter === "Girls" ? "active" : ""}`}
              onClick={() => setGenderFilter("Girls")}
            >
              👧 Girls
            </button>
          </div>
        </div>
      </div>

      {/* Event Cards Grid */}
      <div className="grid">
        {filteredEvents.map((e: any) => {
          const r = s.results[e.id];
          const pts = e.points || (e.category === "Games" ? cfg.categoryPoints?.Games : cfg.categoryPoints?.Athletics) || [5, 3, 1];

          return (
            <div className="card" key={e.id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="flex-between" style={{ marginBottom: "6px" }}>
                  <span className="badge orange">{e.category}</span>
                  <span className="badge navy">{e.gender}</span>
                </div>
                <h3>{e.name}</h3>
                <p className="muted" style={{ marginBottom: "12px" }}>
                  Points: 1st ({pts[0]}), 2nd ({pts[1]}), 3rd ({pts[2]})
                </p>

                {r ? (
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    {r.places.map((p: any, i: number) => (
                      <div key={i} style={{ padding: "4px 0", fontSize: "0.88rem" }}>
                        <strong>{medal[i]}</strong> {p.name}{" "}
                        <span className="muted">· {p.house} (+{pts[i]} pts)</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "12px 0" }}>
                    <p className="muted">⏳ Result awaited · {s.counts[e.id] || 0} registered</p>
                  </div>
                )}
              </div>

              {r && (
                <div style={{ marginTop: "12px", borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
                  <span className="badge green">Podium Published</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
