import { useState } from "react";
import { api } from "../api";

export default function Points() {
  const [reg, setReg] = useState("");
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const find = async () => {
    if (!reg.trim()) return;
    setLoading(true);
    try {
      const data = await api("/student/" + encodeURIComponent(reg.trim()));
      setD(data);
      setErr("");
    } catch (e: any) {
      setD(null);
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card narrow">
      <h2>Check My Points</h2>
      <p className="muted" style={{ marginBottom: "16px" }}>
        Enter your student register number to view your registered events and points contributed to your team.
      </p>

      <label>
        Register number
        <div className="flex-gap" style={{ marginTop: "6px" }}>
          <input
            placeholder="e.g. 21BCA104"
            value={reg}
            onChange={(e) => setReg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && find()}
            style={{ margin: 0, flex: 1 }}
          />
          <button className="btn" onClick={find} disabled={loading}>
            {loading ? "Checking…" : "Show Points"}
          </button>
        </div>
      </label>

      {err && (
        <p className="err" style={{ marginTop: "12px" }}>
          {err}
        </p>
      )}

      {d && (
        <div style={{ marginTop: "24px", borderTop: "1px solid var(--line)", paddingTop: "18px" }}>
          <div className="flex-between" style={{ marginBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0 }}>{d.name}</h3>
              <span className="muted">Reg No: {d.reg}</span>
            </div>
            <div className="flex-gap">
              <span className="badge navy">{d.house} House</span>
              <span className="badge orange">{d.gender}</span>
            </div>
          </div>

          <div className="scroll" style={{ margin: "14px 0" }}>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r: any) => (
                  <tr key={r.eventId}>
                    <td>
                      <span className="badge orange">{r.category}</span>
                    </td>
                    <td>
                      <strong>{r.eventName}</strong>
                    </td>
                    <td>
                      <span className={r.status.includes("1st") || r.status.includes("2nd") || r.status.includes("3rd") ? "ok" : "muted"}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <strong>+{r.points} pts</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="flex-between"
            style={{
              background: "var(--navy)",
              color: "#fff",
              padding: "14px 18px",
              borderRadius: "10px",
              marginTop: "16px",
            }}
          >
            <span style={{ fontWeight: 700 }}>Total Points Contributed:</span>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--orange)" }}>
              {d.total} pts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
