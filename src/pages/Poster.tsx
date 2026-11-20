import { useEffect, useRef, useState } from "react";
import { usePoll } from "../hooks";
import PinGate from "../components/PinGate";

const W = 1080,
  H = 1350;

function PosterStudio() {
  const cfg = usePoll("/config", 60000);
  const s = usePoll("/state", 10000);
  const [f, setF] = useState({
    title: "Winners",
    sub: "DCAS Sports Meet 2026",
    lines: "",
    color: "#f47b00",
  });
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setLogo(i);
    i.src = "/dcas-logo.png";
  }, []);

  useEffect(() => {
    const c = cv.current?.getContext("2d");
    if (!c) return;

    const draw = () => {
      c.fillStyle = "#002656";
      c.fillRect(0, 0, W, H);

      if (photo) {
        const k = Math.max(W / photo.width, 650 / photo.height);
        c.drawImage(photo, (W - photo.width * k) / 2, 0, photo.width * k, photo.height * k);
        const g = c.createLinearGradient(0, 250, 0, 700);
        g.addColorStop(0, "rgba(0,38,86,0)");
        g.addColorStop(1, "#002656");
        c.fillStyle = g;
        c.fillRect(0, 0, W, 700);
      }

      c.fillStyle = f.color;
      c.fillRect(0, 0, W, 18);

      if (logo) {
        c.fillStyle = "#fff";
        c.fillRect(60, 60, 300, 100);
        c.drawImage(logo, 70, 66, 280, 88);
      }

      c.fillStyle = "#fff";
      c.textBaseline = "alphabetic";
      c.font = "800 140px 'Barlow Condensed', Impact, sans-serif";
      f.title
        .toUpperCase()
        .split("\n")
        .forEach((t, i) => c.fillText(t, 60, 760 + i * 130, W - 120));

      c.fillStyle = f.color;
      c.font = "700 42px 'Open Sans', sans-serif";
      c.fillText(f.sub, 60, 860 + (f.title.split("\n").length - 1) * 130, W - 120);

      c.fillStyle = "#fff";
      c.font = "700 52px 'Open Sans', sans-serif";
      f.lines
        .split("\n")
        .slice(0, 6)
        .forEach((t, i) => c.fillText(t, 60, 990 + i * 68, W - 120));
    };

    draw();
    document.fonts?.ready.then(draw);
  }, [f, photo, logo]);

  const fill = (id: string) => {
    const e = cfg?.events.find((x: any) => x.id === id);
    const r = s?.results[id];
    if (!e) return;
    setF({
      ...f,
      title: `${e.name}\nWINNERS`,
      sub: `${e.category} · ${e.gender} · DCAS Sports Meet 2026`,
      lines: r
        ? r.places
            .map((p: any, i: number) => `${["🥇 1st", "🥈 2nd", "🥉 3rd"][i]}  ${p.name} (${p.house})`)
            .join("\n")
        : "",
    });
  };

  const upload = (file?: File) => {
    if (!file) return;
    const i = new Image();
    i.onload = () => setPhoto(i);
    i.src = URL.createObjectURL(file);
  };

  const download = () =>
    cv.current?.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `sportsmeet-poster-${Date.now()}.png`;
      a.click();
    });

  const publishedEvents = cfg?.events.filter((e: any) => s?.results[e.id]) || [];

  return (
    <div className="poster">
      <div className="card">
        <div className="flex-between" style={{ marginBottom: "12px" }}>
          <h2>Victory Poster Studio</h2>
          <a href="#/admin" className="btn sm ghost">
            ← Back to Admin Desk
          </a>
        </div>
        <p className="muted" style={{ marginBottom: "16px" }}>
          Generate official social media announcement graphics (1080×1350) for published winners. This feature is restricted to event administrators.
        </p>

        <label>
          Fill from a published result
          <select onChange={(e) => fill(e.target.value)} defaultValue="">
            <option value="">Choose a published event…</option>
            {publishedEvents.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.category} · {e.name} ({e.gender})
              </option>
            ))}
          </select>
        </label>

        <label>
          Headline
          <textarea rows={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>

        <label>
          Sub headline
          <input value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} />
        </label>

        <label>
          Winner Details (one per line)
          <textarea rows={4} value={f.lines} onChange={(e) => setF({ ...f, lines: e.target.value })} />
        </label>

        <label>
          Accent Color
          <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
        </label>

        <label>
          Action Photo (optional)
          <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} />
        </label>

        <button className="btn" onClick={download} style={{ width: "100%", marginTop: "12px" }}>
          Download Poster (PNG)
        </button>
      </div>

      <div>
        <canvas ref={cv} width={W} height={H} aria-label="Poster preview" />
      </div>
    </div>
  );
}

export default function Poster() {
  return (
    <PinGate role="admin">
      {() => <PosterStudio />}
    </PinGate>
  );
}
