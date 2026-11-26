import { useState } from "react";
import { api } from "../api";
import { usePoll } from "../hooks";
import { isRelayEvent } from "../localDb";
import BulkRegistrationImport from "../components/BulkRegistrationImport";

export default function Register() {
  const cfg = usePoll("/config", 5000);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [session, setSession] = useState<{ username: string; password: string; house: string; name: string } | null>(null);
  const captainRegs = usePoll<any[]>("/captain/registrations", 5000, session?.password, session?.username);
  const [loginError, setLoginError] = useState("");
  const [form, setForm] = useState({ reg: "", name: "", gender: "", eventIds: [] as string[], picture: "" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<string[]>([]);

  const login = async () => {
    setLoginError("");
    try {
      const result = await api("/captain/login", credentials);
      setSession({ username: credentials.username, password: credentials.password, house: result.house, name: result.name });
    } catch (error: any) {
      setLoginError(error.message);
    }
  };

  const readPicture = (file?: File) => {
    if (!file) return;
    if (file.size > 2_500_000) {
      setMessage({ ok: false, text: "Please choose an image smaller than 2.5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, picture: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const toggleEvent = (eventId: string) => {
    const event = cfg?.events?.find((item: any) => item.id === eventId);
    if (!event) return;
    setForm((current) => {
      if (current.eventIds.includes(eventId)) {
        return { ...current, eventIds: current.eventIds.filter((id) => id !== eventId) };
      }
      if (event.category === "Athletics") {
        const selectedEvents = current.eventIds
          .map((id) => cfg.events.find((item: any) => item.id === id))
          .filter(Boolean);
        if (isRelayEvent(event) && selectedEvents.some((item: any) => isRelayEvent(item))) return current;
        if (!isRelayEvent(event) && selectedEvents.filter((item: any) => item.category === "Athletics" && !isRelayEvent(item)).length >= 3) {
          return current;
        }
      }
      return { ...current, eventIds: [...current.eventIds, eventId] };
    });
  };

  const submit = async () => {
    if (!session) return;
    if (!form.reg.trim() || !form.name.trim()) {
      setMessage({ ok: false, text: "Register number and full name are required." });
      return;
    }
    if (!form.gender) {
      setMessage({ ok: false, text: "Select the participant's division." });
      return;
    }
    if (!form.picture) {
      setMessage({ ok: false, text: "Participant picture is required." });
      return;
    }
    if (!form.eventIds.length) {
      setMessage({ ok: false, text: "Select at least one event." });
      return;
    }
    try {
      await api(
        "/captain/register",
        form,
        session.password,
        session.username
      );
      setMessage({ ok: true, text: `${form.name} was registered successfully for ${session.house}.` });
      setForm({ reg: "", name: "", gender: "", eventIds: [], picture: "" });
    } catch (error: any) {
      setMessage({ ok: false, text: error.message });
    }
  };

  const removeRegistration = async (id: string, name: string) => {
    if (!session || !confirm(`Remove ${name}'s registration from this event?`)) return;
    try {
      const result = await api(`/captain/unregister/${id}`, {}, session.password, session.username);
      setSelectedRegistrationIds((current) => current.filter((selectedId) => selectedId !== id));
      setMessage({
        ok: !result.warnings?.length,
        text: result.warnings?.length ? result.warnings.join("; ") : `Removed ${name}'s registration.`,
      });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Could not remove registration" });
    }
  };

  const removeSelectedRegistrations = async () => {
    if (!session || !selectedRegistrationIds.length || !confirm(`Remove ${selectedRegistrationIds.length} selected registration${selectedRegistrationIds.length === 1 ? "" : "s"}?`)) return;
    try {
      const result = await api(
        "/captain/unregister-bulk",
        { ids: selectedRegistrationIds },
        session.password,
        session.username
      );
      setSelectedRegistrationIds([]);
      setMessage({
        ok: !result.warnings?.length,
        text: result.warnings?.length
          ? `Removed ${result.removed} registration(s). ${result.warnings.join("; ")}`
          : `Removed ${result.removed} registration(s).`,
      });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Could not remove registrations" });
    }
  };

  if (!cfg) return <p className="muted">Loading captain registration…</p>;

  if (!session) {
    return (
      <div className="card narrow">
        <h2>House Captain Login</h2>
        <p className="muted">Authorized house captains can register participants for their house.</p>
        <label>
          Captain username
          <input value={credentials.username} onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} />
        </label>
        <label>
          Captain password
          <input type="password" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} />
        </label>
        {loginError && <p className="err">{loginError}</p>}
        <button className="btn" onClick={login}>Continue</button>
      </div>
    );
  }

  const events = (cfg.events || []).filter((event: any) => {
    if (!form.gender) return false;
    if (event.gender === "Mixed") return true;
    return String(event.gender).toLowerCase() === String(form.gender).toLowerCase();
  });

  return (
    <div className="card narrow">
      <div className="flex-between" style={{ marginBottom: "12px" }}>
        <div>
          <h2>Register Participant</h2>
          <p className="muted">{session.name} · {session.house} House</p>
        </div>
        <button className="btn sm ghost" onClick={() => { setSession(null); setSelectedRegistrationIds([]); }}>Logout</button>
      </div>

      <label>Register number<input value={form.reg} onChange={(e) => setForm({ ...form, reg: e.target.value })} /></label>
      <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>
        Division
        <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value, eventIds: [] })}>
          <option value="">Select division…</option>
          <option value="Boys">Boys</option>
          <option value="Girls">Girls</option>
        </select>
      </label>
      <label>
        Participant picture
        <input type="file" accept="image/*" onChange={(e) => readPicture(e.target.files?.[0])} />
      </label>
      {form.picture && <img src={form.picture} alt="Participant preview" style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "12px", marginBottom: "14px" }} />}

      {form.gender && (
        <>
          <h3>Select events</h3>
          <p className="muted">
            Each student may enter up to 3 individual Athletics events plus one relay. Each house may enter up to 3 participants per Athletics event (4 for a relay). Games have no student event limit; all same-house entries for a Games item belong to that house’s one team.
          </p>
          <div className="chips">
            {events.map((event: any) => {
              const selected = form.eventIds.includes(event.id);
              const selectedEvents = form.eventIds
                .map((id) => cfg.events.find((item: any) => item.id === id))
                .filter(Boolean);
              const relaySelected = selectedEvents.some((item: any) => isRelayEvent(item));
              const individualAthleticsCount = selectedEvents.filter((item: any) => item.category === "Athletics" && !isRelayEvent(item)).length;
              const limitReached = !selected && event.category === "Athletics" &&
                (isRelayEvent(event) ? relaySelected : individualAthleticsCount >= 3);
              return (
                <button
                  type="button"
                  key={event.id}
                  className={"chip" + (selected ? " on" : "")}
                  disabled={limitReached || (!selected && event.registrationOpen === false)}
                  onClick={() => toggleEvent(event.id)}
                  title={event.registrationOpen === false ? "Registration is closed for this event" : limitReached ? "Athletics limit reached" : undefined}
                >
                  {event.name}<small>{event.category}</small>
                </button>
              );
            })}
          </div>
        </>
      )}

      {message && <p className={message.ok ? "ok" : "err"}>{message.text}</p>}
      <button className="btn" onClick={submit}>Register Participant</button>

      <BulkRegistrationImport
        events={cfg.events || []}
        houses={cfg.houses || []}
        captainUsername={session.username}
        captainPassword={session.password}
        house={session.house}
        onComplete={() => setMessage({ ok: true, text: "Bulk registration completed successfully." })}
      />

      <section style={{ marginTop: "32px", borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
        <div className="flex-between" style={{ marginBottom: "12px" }}>
          <div>
            <h3>Your House Registrations</h3>
            <p className="muted">{captainRegs?.length || 0} event registration(s) for {session.house}</p>
          </div>
          <button className="btn sm danger" onClick={() => void removeSelectedRegistrations()} disabled={!selectedRegistrationIds.length}>
            Remove selected
          </button>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr><th><input
                type="checkbox"
                aria-label="Select all house registrations"
                checked={Boolean(captainRegs?.length) && (captainRegs || []).every((registration) => selectedRegistrationIds.includes(registration.id))}
                onChange={(event) => setSelectedRegistrationIds(event.target.checked ? (captainRegs || []).map((registration) => registration.id) : [])}
                disabled={!captainRegs?.length}
              /></th><th>Participant</th><th>Reg No</th><th>Event</th><th>Action</th></tr>
            </thead>
            <tbody>
              {captainRegs?.map((registration) => {
                const event = cfg.events?.find((item: any) => item.id === registration.eventId);
                return (
                  <tr key={registration.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${registration.name} registration`}
                        checked={selectedRegistrationIds.includes(registration.id)}
                        onChange={(change) => setSelectedRegistrationIds((current) =>
                          change.target.checked
                            ? [...current, registration.id]
                            : current.filter((id) => id !== registration.id)
                        )}
                      />
                    </td>
                    <td>{registration.name}</td>
                    <td>{registration.reg}</td>
                    <td>{event?.name || registration.eventId}</td>
                    <td><button className="btn sm danger" onClick={() => void removeRegistration(registration.id, registration.name)}>Remove</button></td>
                  </tr>
                );
              })}
              {captainRegs?.length === 0 && <tr><td colSpan={5} className="muted">No registrations for your house yet.</td></tr>}
              {!captainRegs && <tr><td colSpan={5} className="muted">Loading house registrations…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
