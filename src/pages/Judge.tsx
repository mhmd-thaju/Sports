import { useEffect, useState } from "react";
import { api } from "../api";
import { usePoll } from "../hooks";
import PinGate from "../components/PinGate";

function ordinal(position: number): string {
  const suffix = position % 100 >= 11 && position % 100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[position % 10] || "th";
  return `${position}${suffix}`;
}

function Board({ pin, judge }: { pin: string; judge: string }) {
  const cfg = usePoll("/config", 5000);
  const [eid, setEid] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [submission, setSubmission] = useState<any>(null);
  const [published, setPublished] = useState(false);
  const [msg, setMsg] = useState("");
  const selectedEvent = (cfg?.events || []).find((event: any) => event.id === eid);
  const isGamesEvent = selectedEvent?.category === "Games";

  const load = async () => {
    if (!eid) {
      setRows([]);
      setSubmission(null);
      setPublished(false);
      return;
    }
    try {
      const result = await api("/entries/" + eid, undefined, pin, judge);
      const entries = Array.isArray(result.entries) ? result.entries : [];
      setRows(entries);
      setPositions(Object.fromEntries(entries.map((entry: any) => [entry.reg, entry.position ? String(entry.position) : ""])));
      setSubmission(result.submission || null);
      setPublished(Boolean(result.published));
      setMsg("");
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  useEffect(() => {
    void load();
  }, [eid, pin, judge]);

  const submitResults = async () => {
    if (published) return;
    const ranked = rows
      .filter((row) => !isGamesEvent || Boolean(positions[row.reg]))
      .map((row) => ({ reg: row.reg, position: Number(positions[row.reg]) }));
    const ranks = ranked.map((entry) => entry.position);
    const nonSequentialGamesRanking = [...ranks].sort((a, b) => a - b).some((rank, index) => rank !== index + 1);
    const invalidGamesRanking = isGamesEvent && (
      ranked.length < 2 ||
      !ranks.includes(1) ||
      !ranks.includes(2) ||
      ranked.some((entry) => !Number.isInteger(entry.position) || entry.position < 1 || entry.position > Math.min(4, rows.length)) ||
      new Set(ranks).size !== ranked.length ||
      nonSequentialGamesRanking
    );
    const invalidOtherRanking = !isGamesEvent && (
      !rows.length ||
      ranked.some((entry) => !Number.isInteger(entry.position) || entry.position < 1 || entry.position > rows.length) ||
      new Set(ranks).size !== rows.length
    );
    if (invalidGamesRanking || invalidOtherRanking) {
      setMsg(isGamesEvent
        ? "Select 1st and 2nd. 3rd and 4th are optional, but must be assigned in order; they receive no points."
        : "Assign a unique position to every participant or team before submitting.");
      return;
    }
    try {
      await api("/judge/submit/" + eid, { positions: ranked }, pin, judge);
      setMsg("Results submitted for admin review ✓");
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const allEvents = cfg?.events || [];
  const eventOptions = allEvents;

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: "12px" }}>
        <h2>
          Judge Placings <small className="muted">({judge})</small>
        </h2>
        <span className="badge navy">Judge Panel</span>
      </div>

      <label>
        Select Event to Judge
        <select value={eid} onChange={(e) => setEid(e.target.value)}>
          <option value="">Choose event…</option>
          {eventOptions.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.category} · {e.name} ({e.gender})
            </option>
          ))}
        </select>
      </label>

      {submission && !published && (
        <p className="ok" role="status">
          Submitted by {submission.judge} at {new Date(submission.submittedAt).toLocaleString()}. You can update these placings before the admin publishes them.
        </p>
      )}
      {published && <p className="muted" role="status">Results are published. Ask an admin to unpublish this event before changing placings.</p>}
      {isGamesEvent && <p className="muted">Games: 1st and 2nd are required. 3rd and 4th are optional, in order, and receive no points.</p>}

      {rows.map((r) => (
        <div className="row" key={r.reg}>
          <span>
            <strong>{r.name}</strong>{" "}
            <small className="muted">
              ({r.reg} · {r.house}{r.members ? ` · ${r.members} team members` : ""})
            </small>
          </span>
          <label style={{ minWidth: "180px", margin: 0 }}>
            Position
            <select
              value={positions[r.reg] || ""}
              disabled={published}
              onChange={(e) => setPositions((current) => ({ ...current, [r.reg]: e.target.value }))}
              aria-label={"Position for " + r.name}
            >
              <option value="">Select position…</option>
              {Array.from({ length: isGamesEvent ? Math.min(4, rows.length) : rows.length }, (_, index) => index + 1).map((position) => {
                const takenByAnother = Object.entries(positions).some(([reg, value]) => reg !== r.reg && Number(value) === position);
                return (
                  <option key={position} value={position} disabled={takenByAnother || (isGamesEvent && position === 4 && !Object.values(positions).some((value) => Number(value) === 3))}>
                    {ordinal(position)}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
      ))}

      {eid && !rows.length && (
        <p className="muted" style={{ padding: "16px 0", textAlign: "center" }}>
          No registered participants or house teams for this event yet.
        </p>
      )}

      {rows.length > 0 && !published && (
        <button className="btn" onClick={submitResults} style={{ marginTop: "16px" }}>
          Submit Results to Admin
        </button>
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
