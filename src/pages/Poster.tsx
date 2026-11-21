import { useEffect, useRef, useState } from "react";
import { usePoll } from "../hooks";
import PinGate from "../components/PinGate";
import { isRelayEvent } from "../localDb";

const W = 1080;
const H = 1350;
const medalColors = ["#d9a441", "#aab5c2", "#b87953"];
const placeLabels = ["1st place", "2nd place", "3rd place"];

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  let last = visible[maxLines - 1];
  while (last && ctx.measureText(`${last}...`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  visible[maxLines - 1] = `${last.trimEnd()}...`;
  return visible;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function loadPosterImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    if (/^https?:\/\//i.test(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  initials: string,
  centerX: number,
  centerY: number,
  size: number,
  accent: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#e7edf4";
  ctx.fill();
  if (image?.naturalWidth) {
    drawCoverImage(ctx, image, centerX - size / 2, centerY - size / 2, size, size);
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
    ctx.fillStyle = "#fff";
    ctx.font = "800 62px 'Open Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials || "W", centerX, centerY);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(centerX, centerY, size / 2 + 5, 0, Math.PI * 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, size / 2 + 10, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
}

function parseWinnerLine(line: string, index: number) {
  const detail = line.replace(/^\s*(?:🥇|🥈|🥉)?\s*\d+(?:st|nd|rd|th)?\s*/i, "").trim();
  const match = detail.match(/^(.*?)\s+\((.*?)\)\s*$/);
  return {
    name: match?.[1]?.trim() || detail || "Awaiting result",
    house: match?.[2]?.trim() || placeLabels[index],
  };
}

function PosterStudio() {
  const cfg = usePoll("/config", 5000);
  const s = usePoll("/state", 3000);
  const [f, setF] = useState({
    title: "MEET CHAMPIONS",
    sub: "ATHLETICS - DCAS SPORTS MEET 2026",
    lines: "",
    color: "#f47b00",
  });
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [winnerPhotos, setWinnerPhotos] = useState<Array<HTMLImageElement | null>>([]);
  const [photoError, setPhotoError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoLoadRef = useRef(0);
  const manualPhotoIndexes = useRef(new Set<number>());

  useEffect(() => {
    let active = true;
    void Promise.all([loadPosterImage("/dcas-logo.png"), loadPosterImage("/dcas-campus.jpg")]).then(([loadedLogo, background]) => {
      if (!active) return;
      setLogo(loadedLogo);
      setPhoto(background);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const base = ctx.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, "#072650");
      base.addColorStop(1, "#07152d");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);

      if (photo) drawCoverImage(ctx, photo, 0, 0, W, H);
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, "rgba(0, 20, 48, 0.72)");
      shade.addColorStop(0.43, "rgba(0, 25, 58, 0.78)");
      shade.addColorStop(1, "rgba(4, 17, 38, 0.94)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W, 16);
      if (logo?.naturalWidth) {
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        roundedRect(ctx, 48, 42, 250, 76, 14);
        ctx.fill();
        const logoScale = Math.min(218 / logo.naturalWidth, 54 / logo.naturalHeight);
        const logoWidth = logo.naturalWidth * logoScale;
        const logoHeight = logo.naturalHeight * logoScale;
        ctx.drawImage(logo, 63, 53 + (54 - logoHeight) / 2, logoWidth, logoHeight);
      }

      ctx.fillStyle = "rgba(255,255,255,0.14)";
      roundedRect(ctx, 728, 56, 304, 48, 24);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 20px 'Open Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("DUXFORD COLLEGE FOR ADVANCED STUDIES", 880, 80, 276);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      ctx.fillStyle = f.color;
      ctx.font = "800 20px 'Open Sans', sans-serif";
      ctx.fillText("OFFICIAL EVENT PODIUM", 60, 184);
      ctx.fillStyle = "#fff";
      ctx.font = "900 104px 'Barlow Condensed', Impact, sans-serif";
      const titleLines = wrapText(ctx, f.title.toUpperCase(), 960, 2);
      titleLines.forEach((line, index) => ctx.fillText(line, 56, 300 + index * 96, 960));

      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "700 25px 'Open Sans', sans-serif";
      ctx.fillText(f.sub.toUpperCase(), 62, titleLines.length === 2 ? 502 : 406, 950);

      ctx.fillStyle = f.color;
      roundedRect(ctx, 60, 546, 58, 6, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 22px 'Open Sans', sans-serif";
      ctx.fillText("THE PODIUM", 132, 554);

      const lines = f.lines.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3);
      const cards = [
        { place: 2, x: 48, y: 644, width: 306, height: 572 },
        { place: 1, x: 387, y: 606, width: 306, height: 610 },
        { place: 3, x: 726, y: 644, width: 306, height: 572 },
      ];

      cards.forEach((card) => {
        const index = card.place - 1;
        const line = lines[index] || "";
        const detail = parseWinnerLine(line, index);
        const accent = medalColors[index];
        const featured = card.place === 1;
        const imageSize = featured ? 204 : 176;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.28)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 12;
        roundedRect(ctx, card.x, card.y, card.width, card.height, 26);
        ctx.fillStyle = "rgba(250,251,253,0.97)";
        ctx.fill();
        ctx.restore();

        roundedRect(ctx, card.x, card.y, card.width, card.height, 26);
        ctx.strokeStyle = featured ? accent : "rgba(255,255,255,0.72)";
        ctx.lineWidth = featured ? 5 : 2;
        ctx.stroke();

        ctx.fillStyle = accent;
        roundedRect(ctx, card.x + 22, card.y + 20, 116, 36, 18);
        ctx.fill();
        ctx.fillStyle = "#102a49";
        ctx.font = "800 16px 'Open Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(placeLabels[index].toUpperCase(), card.x + 80, card.y + 38);

        const centerX = card.x + card.width / 2;
        const centerY = card.y + (featured ? 174 : 166);
        const initials = detail.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
        drawPortrait(ctx, winnerPhotos[index] || null, initials, centerX, centerY, imageSize, accent);

        ctx.fillStyle = "#102a49";
        ctx.font = `800 ${featured ? 31 : 27}px 'Open Sans', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const nameLines = wrapText(ctx, detail.name, card.width - 44, 2);
        const nameStart = card.y + (featured ? 324 : 308);
        nameLines.forEach((line, lineIndex) => ctx.fillText(line, centerX, nameStart + lineIndex * 34, card.width - 44));

        ctx.fillStyle = "#657286";
        ctx.font = "600 19px 'Open Sans', sans-serif";
        wrapText(ctx, detail.house, card.width - 48, 2).forEach((line, lineIndex) => {
          ctx.fillText(line, centerX, nameStart + nameLines.length * 34 + 14 + lineIndex * 25, card.width - 48);
        });

        ctx.fillStyle = accent;
        roundedRect(ctx, card.x + 34, card.y + card.height - 70, card.width - 68, 3, 2);
        ctx.fill();
        ctx.fillStyle = "#41516a";
        ctx.font = "800 15px 'Open Sans', sans-serif";
        ctx.fillText(line ? "DCAS SPORTS MEET 2026" : "AWAITING RESULT", centerX, card.y + card.height - 40);
        ctx.textAlign = "left";
      });

      ctx.fillStyle = f.color;
      ctx.fillRect(0, 1280, W, 70);
      ctx.fillStyle = "#fff";
      ctx.font = "700 18px 'Open Sans', sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("DUXFORD COLLEGE FOR ADVANCED STUDIES", 56, 1315);
      ctx.textAlign = "right";
      ctx.fillText("DCAS - SPORTS MEET", W - 56, 1315);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    };

    draw();
    void document.fonts?.ready.then(draw);
  }, [f, logo, photo, winnerPhotos]);

  const fill = async (id: string) => {
    const event = cfg?.events.find((item: any) => item.id === id);
    if (!event) return;
    const result = s?.results[id];
    const isTeam = event.category === "Games" || isRelayEvent(event);
    const places = (result?.places || []).slice(0, 3);
    const generation = ++photoLoadRef.current;
    manualPhotoIndexes.current = new Set<number>();
    setPhotoError("");
    setF((current) => ({
      ...current,
      title: `${event.name} CHAMPIONS`,
      sub: `${event.category} - ${event.gender} - DCAS SPORTS MEET 2026`,
      lines: places.map((place: any, index: number) => {
        const rank = ["1st", "2nd", "3rd"][index];
        return isTeam
          ? `${rank}  ${place.house || place.name} Team (${place.house || "House"})`
          : `${rank}  ${place.name || place.id} (${place.house || "House"})`;
      }).join("\n"),
    }));
    setWinnerPhotos(places.map(() => null));
    const images = await Promise.all(places.map((place: any) => place.picture ? loadPosterImage(place.picture) : Promise.resolve(null)));
    if (generation !== photoLoadRef.current) return;
    setWinnerPhotos((current) => images.map((image, index) =>
      manualPhotoIndexes.current.has(index) ? current[index] || image : image
    ));
    if (places.some((place: any, index: number) => place.picture && !images[index])) {
      setPhotoError("Some participant photos could not be loaded. Use the portrait controls to choose replacements.");
    }
  };

  const readWinnerPhoto = (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2_500_000) {
      setPhotoError("Choose an image smaller than 2.5 MB.");
      return;
    }
    setPhotoError("");
    const generation = photoLoadRef.current;
    const reader = new FileReader();
    reader.onerror = () => setPhotoError("Could not read the selected portrait.");
    reader.onload = async () => {
      const image = await loadPosterImage(String(reader.result || ""));
      if (!image) {
        setPhotoError("Could not load the selected portrait.");
        return;
      }
      if (generation !== photoLoadRef.current) return;
      manualPhotoIndexes.current.add(index);
      setWinnerPhotos((current) => {
        const updated = [...current];
        updated[index] = image;
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const uploadBackground = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file for the poster background.");
      return;
    }
    const src = URL.createObjectURL(file);
    void loadPosterImage(src).then((image) => {
      URL.revokeObjectURL(src);
      if (image) {
        setPhotoError("");
        setPhoto(image);
      } else {
        setPhotoError("Could not load the selected background image.");
      }
    });
  };

  const download = () => {
    try {
      canvasRef.current?.toBlob((blob) => {
        if (!blob) {
          setPhotoError("Could not export the poster. Check that the selected images can be used in a canvas.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `sportsmeet-poster-${Date.now()}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Could not export the poster.");
    }
  };

  const publishedEvents = cfg?.events.filter((event: any) => s?.results[event.id]) || [];
  const lines = f.lines.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3);

  return (
    <div className="poster">
      <div className="card">
        <div className="flex-between" style={{ marginBottom: "12px" }}>
          <h2>Victory Poster Studio</h2>
          <a href="#/admin" className="btn sm ghost">Back to Admin Desk</a>
        </div>
        <p className="muted" style={{ marginBottom: "16px" }}>
          Create a portrait-led podium poster with the published athletes' photos. Portrait changes here affect only the downloaded poster.
        </p>

        <label>
          Fill from a published result
          <select onChange={(event) => void fill(event.target.value)} defaultValue="">
            <option value="">Choose a published event...</option>
            {publishedEvents.map((event: any) => (
              <option key={event.id} value={event.id}>{event.category} - {event.name} ({event.gender})</option>
            ))}
          </select>
        </label>

        <label>
          Headline
          <textarea rows={2} value={f.title} onChange={(event) => setF({ ...f, title: event.target.value })} />
        </label>
        <label>
          Sub headline
          <input value={f.sub} onChange={(event) => setF({ ...f, sub: event.target.value })} />
        </label>
        <label>
          Podium details (one per line, in finishing order)
          <textarea
            rows={3}
            value={f.lines}
            onChange={(event) => setF({ ...f, lines: event.target.value })}
            placeholder={"1st  Winner Name (House)\\n2nd  Runner-up (House)\\n3rd  Third place (House)"}
          />
        </label>

        <div className="poster-portrait-controls">
          {placeLabels.map((label, index) => (
            <label key={label}>
              {label} portrait {winnerPhotos[index] ? "(loaded)" : "(optional)"}
              <input type="file" accept="image/*" onChange={(event) => readWinnerPhoto(index, event.target.files?.[0])} />
              {winnerPhotos[index] && (
                <img
                  src={winnerPhotos[index]?.src}
                  alt={`${label} preview`}
                  style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "50%", marginTop: "8px" }}
                />
              )}
            </label>
          ))}
        </div>

        <label>
          Accent color
          <input type="color" value={f.color} onChange={(event) => setF({ ...f, color: event.target.value })} />
        </label>
        <label>
          Poster background photo
          <input type="file" accept="image/*" onChange={(event) => uploadBackground(event.target.files?.[0])} />
        </label>
        {photoError && <p className="err">{photoError}</p>}
        <button className="btn" onClick={download} style={{ width: "100%", marginTop: "12px" }}>
          Download Poster (PNG)
        </button>
      </div>

      <div>
        <canvas ref={canvasRef} width={W} height={H} aria-label="Victory poster preview" />
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
