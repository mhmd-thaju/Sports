import { useEffect, useState } from "react";
import { api } from "../api";
import { usePoll } from "../hooks";
import PinGate from "../components/PinGate";

function Board({ pin, judge }: { pin: string; judge: string }) {
  const cfg = usePoll("/config", 60000);
  const [eid, setEid] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const load = () =>
    eid &&
    api("/entries/" + eid, undefined, pin, judge)
      .then(setRows)
      .catch((e) => setMsg(e.message));

  useEffect(() => {
    load();
  }, [eid]);

  const save = (reg: string, score: string) =>
    api("/score", { eventId: eid, reg, score }, pin, judge)
      .then(() => setMsg("Score saved ✓"))
      .catch((e) => setMsg(e.message));

  const judgedEvents = cfg?.events?.filter((e: any) => e.type === "judged") || [];
  const allEvents = cfg?.events || [];
  const eventOptions = judgedEvents.length > 0 ? judgedEvents : allEvents;

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: "12px" }}>
        <h2>
          Judge Scoring <small className="muted">({judge})</small>
        </h2>
        <span className="badge navy">Judge Panel</span>
      </div>

      <label>
        Select Event to Score
        <select value={eid} onChange={(e) => setEid(e.target.value)}>
          <option value="">Choose event…</option>
          {eventOptions.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.category} · {e.name} ({e.gender})
            </option>
          ))}
        </select>
      </label>

      {rows.map((r) => (
        <div className="row" key={r.reg}>
          <span>
            <strong>{r.name}</strong>{" "}
            <small className="muted">
              ({r.reg} · {r.house} House)
            </small>
          </span>
          <div className="flex-gap">
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Score (0-100):
            </span>
            <input
              type="number"
              min={0}
              max={100}
              defaultValue={r.score}
              onBlur={(e) => e.target.value !== "" && save(r.reg, e.target.value)}
              aria-label={"Score for " + r.name}
              style={{ width: "90px" }}
            />
          </div>
        </div>
      ))}

      {eid && !rows.length && (
        <p className="muted" style={{ padding: "16px 0", textAlign: "center" }}>
          No registered student participants for this event yet.
        </p>
      )}

      {msg && (
        <p className="muted" role="status" style={{ marginTop: "12px" }}>
          {msg}
        </p>
      )}
    </div>
  );
}

export default function Judge() {
  return <PinGate role="judge">{(pin, name) => <Board pin={pin} judge={name} />}</PinGate>;
}
