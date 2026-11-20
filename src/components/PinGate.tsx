import { useState, type ReactNode } from "react";

/** Asks for a PIN once per browser session, then renders children(pin, name). */
export default function PinGate({ role, children }: { role: string; children: (pin: string, name: string) => ReactNode }) {
  const [pin, setPin] = useState(sessionStorage.getItem("pin-" + role) || "");
  const [name, setName] = useState(sessionStorage.getItem("name-" + role) || "");
  const [draft, setDraft] = useState({ pin: "", name: "" });
  if (pin) return <>{children(pin, name)}</>;
  return (
    <div className="card narrow">
      <h2>{role} login</h2>
      <label>Your name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>PIN<input type="password" inputMode="numeric" value={draft.pin} onChange={(e) => setDraft({ ...draft, pin: e.target.value })} /></label>
      <button className="btn" onClick={() => {
        sessionStorage.setItem("pin-" + role, draft.pin); sessionStorage.setItem("name-" + role, draft.name || role);
        setPin(draft.pin); setName(draft.name || role);
      }}>Continue</button>
    </div>
  );
}
