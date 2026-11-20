import { useState } from "react";
import { api } from "../api";
import { usePoll } from "../hooks";

export default function Register() {
  const cfg = usePoll("/config", 30000);
  const [f, setF] = useState({ reg: "", name: "", house: "", gender: "" });
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<"All" | "Athletics" | "Games">("All");

  if (!cfg) return <p className="muted">Loading event details…</p>;

  // Filter events matching selected gender
  const availableEvents = (cfg.events || []).filter((e: any) => {
    if (!f.gender) return false;
    if (e.gender === "Mixed") return true;
    const eg = String(e.gender).toLowerCase();
    const fg = String(f.gender).toLowerCase();
    return eg === fg || (eg === "boys" && fg === "men") || (eg === "girls" && fg === "women");
  });

  const athleticsEvents = availableEvents.filter((e: any) => e.category === "Athletics");
  const gamesEvents = availableEvents.filter((e: any) => e.category === "Games");

  const toggle = (id: string) => {
    if (sel.includes(id)) {
      setSel(sel.filter((x) => x !== id));
    } else {
      if (sel.length >= (cfg.maxEventsPerStudent || 3)) {
        setMsg({
          ok: false,
          t: `You can only select up to ${cfg.maxEventsPerStudent || 3} events.`,
        });
        return;
      }
      setSel([...sel, id]);
    }
  };

  const submit = async () => {
    if (!f.reg.trim() || !f.name.trim()) {
      setMsg({ ok: false, t: "Please enter your register number and full name." });
      return;
    }
    if (!f.house) {
      setMsg({ ok: false, t: "Please choose your team / house." });
      return;
    }
    if (!f.gender) {
      setMsg({ ok: false, t: "Please select Boys or Girls category." });
      return;
    }
    if (!sel.length) {
      setMsg({ ok: false, t: "Please select at least one event to participate." });
      return;
    }

    try {
      await api("/register", { ...f, eventIds: sel });
      setMsg({
        ok: true,
        t: "🎉 Successfully registered! You can track your scores under My Points.",
      });
      setSel([]);
      setF({ ...f, reg: "", name: "" });
    } catch (e: any) {
      setMsg({ ok: false, t: e.message });
    }
  };

  return (
    <div className="card narrow">
      <h2>Student Registration</h2>
      <p className="muted" style={{ marginBottom: "16px" }}>
        Enter your details and select your events for <strong>Athletics</strong> and <strong>Games</strong>.
      </p>

      <label>
        Register number
        <input
          placeholder="e.g. 21BCA104"
          value={f.reg}
          onChange={(e) => setF({ ...f, reg: e.target.value })}
        />
      </label>

      <label>
        Full name
        <input
          placeholder="e.g. Rahul Sharma"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </label>

      <label>
        Team / House
        <select value={f.house} onChange={(e) => setF({ ...f, house: e.target.value })}>
          <option value="">Select your house…</option>
          {cfg.houses.map((h: string) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>

      <label>
        Section / Category
        <select
          value={f.gender}
          onChange={(e) => {
            setF({ ...f, gender: e.target.value });
            setSel([]);
          }}
        >
          <option value="">Select category…</option>
          <option value="Boys">Boys</option>
          <option value="Girls">Girls</option>
        </select>
      </label>

      {f.gender ? (
        <div style={{ marginTop: "18px" }}>
          <div className="flex-between" style={{ marginBottom: "10px" }}>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              Select Events ({sel.length}/{cfg.maxEventsPerStudent || 3})
            </span>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Max {cfg.maxEventsPerStudent || 3} events
            </span>
          </div>

          {/* Category Tabs inside Registration */}
          <div className="category-tabs" style={{ marginBottom: "12px" }}>
            <button
              type="button"
              className={`category-tab ${activeCategoryTab === "All" ? "active" : ""}`}
              onClick={() => setActiveCategoryTab("All")}
            >
              All ({availableEvents.length})
            </button>
            <button
              type="button"
              className={`category-tab ${activeCategoryTab === "Athletics" ? "active" : ""}`}
              onClick={() => setActiveCategoryTab("Athletics")}
            >
              🏃 Athletics ({athleticsEvents.length})
            </button>
            <button
              type="button"
              className={`category-tab ${activeCategoryTab === "Games" ? "active" : ""}`}
              onClick={() => setActiveCategoryTab("Games")}
            >
              ⚽ Games ({gamesEvents.length})
            </button>
          </div>

          {/* Athletics Section */}
          {(activeCategoryTab === "All" || activeCategoryTab === "Athletics") && athleticsEvents.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", color: "var(--navy)", marginBottom: "6px" }}>
                🏃 Athletics ({f.gender})
              </div>
              <div className="chips">
                {athleticsEvents.map((e: any) => {
                  const pts = e.points || cfg.categoryPoints?.Athletics || [5, 3, 1];
                  return (
                    <button
                      type="button"
                      key={e.id}
                      className={"chip" + (sel.includes(e.id) ? " on" : "")}
                      onClick={() => toggle(e.id)}
                    >
                      {e.name}
                      <small>{pts[0]}/{pts[1]}/{pts[2]} pts</small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Games Section */}
          {(activeCategoryTab === "All" || activeCategoryTab === "Games") && gamesEvents.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", color: "var(--navy)", marginBottom: "6px" }}>
                ⚽ Games ({f.gender})
              </div>
              <div className="chips">
                {gamesEvents.map((e: any) => {
                  const pts = e.points || cfg.categoryPoints?.Games || [10, 6, 2];
                  return (
                    <button
                      type="button"
                      key={e.id}
                      className={"chip" + (sel.includes(e.id) ? " on" : "")}
                      onClick={() => toggle(e.id)}
                    >
                      {e.name}
                      <small>{pts[0]}/{pts[1]}/{pts[2]} pts</small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="muted" style={{ margin: "14px 0" }}>
          👉 Please select whether you are in the <strong>Boys</strong> or <strong>Girls</strong> section to view your available events.
        </p>
      )}

      <button className="btn" onClick={submit} style={{ width: "100%", marginTop: "12px" }}>
        Submit Registration
      </button>

      {msg && (
        <p className={msg.ok ? "ok" : "err"} role="status" style={{ marginTop: "14px" }}>
          {msg.t}
        </p>
      )}
    </div>
  );
}
