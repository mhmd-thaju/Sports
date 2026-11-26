import { useEffect, useState } from "react";
import { trackGalleryActivity } from "../api";
import { usePoll } from "../hooks";
import { SPORTSITEM_EVENTS } from "../localDb";
import { sortGalleryPhotos } from "../galleryUtils";

type DisplayWinner = {
  event: string;
  category: string;
  name: string;
  house: string;
  result: string;
  initials: string;
  accent: string;
  picture?: string;
};

const houseColors: Record<string, string> = {
  "BCom Co-operation": "#f47b00",
  "BA Economics": "#f5c84b",
  "BCom Finance & BBA": "#1db8a3",
  "GDA, BCA & Psychology": "#6e8bf5",
  "Falcon": "#f47b00",
  "Phoenix": "#f5c84b",
  "Titan": "#1db8a3",
  "Spartan": "#6e8bf5",
};
const defaultColors = ["#f47b00", "#f5c84b", "#1db8a3", "#6e8bf5", "#9333ea", "#ec4899"];

const heroPhoto = "https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=1600&q=85";
const campusPhoto = {
  id: "our-campus",
  src: "/dcas-campus.jpg",
  alt: "Aerial view of the Duxford College campus and sports ground",
  label: "Our Campus",
  className: "md:col-span-2",
};

type GalleryCard = {
  id: string;
  src: string;
  alt: string;
  label: string;
  className: string;
};

const standings = [
  { rank: 1, house: "Falcon House", color: "#f47b00", gold: 14, silver: 9, bronze: 6, points: 126 },
  {
    rank: 2,
    house: "Phoenix House",
    color: "#f5c84b",
    gold: 11,
    silver: 12,
    bronze: 8,
    points: 115,
  },
  { rank: 3, house: "Titan House", color: "#1db8a3", gold: 9, silver: 10, bronze: 13, points: 104 },
  { rank: 4, house: "Spartan House", color: "#6e8bf5", gold: 7, silver: 8, bronze: 9, points: 82 },
];

const eventBackgrounds: Record<string, string> = {
  Football: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1000&q=80",
  Cricket: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1000&q=80",
  Volleyball: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1000&q=80",
  Badminton: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1000&q=80",
  Chess: "https://images.unsplash.com/photo-1586165368502-1bad197a6461?auto=format&fit=crop&w=1000&q=80",
  Throwball: "https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=1000&q=80",
  "Mini Dodgeball": "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1000&q=80",
  "Kho-Kho": "https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=1000&q=80",
  Athletics: "https://images.unsplash.com/photo-1532444458054-01a7dd3e9fca?auto=format&fit=crop&w=1000&q=80",
};

function Icon({
  name,
  size = 20,
}: {
  name: "arrow" | "calendar" | "clock" | "map" | "trophy" | "close" | "menu";
  size?: number;
}) {
  const paths = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0Z" />
        <path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function App() {
  const s = usePoll("/state", 4000);
  const cfg = usePoll("/config", 5000);
  const galleryData = usePoll<{ photos: any[] }>("/gallery", 5000);
  const scheduleItems = Array.isArray(cfg?.schedule) ? cfg.schedule : [];
  const [menuOpen, setMenuOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [winnerFilter, setWinnerFilter] = useState("All");
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const recentPhotos = sortGalleryPhotos(galleryData?.photos || cfg?.gallery).slice(0, 3);
  const latestPhotoCards: GalleryCard[] = recentPhotos.map((photo, index) => ({
    id: photo.id || photo.src,
    src: photo.src,
    alt: photo.caption || "Sports meet photo",
    label: photo.caption || "Latest event photo",
    className: index === 0 ? "md:col-span-2 md:row-span-2" : "",
  }));
  while (latestPhotoCards.length < 3) {
    latestPhotoCards.push({
      id: `latest-photo-placeholder-${latestPhotoCards.length}`,
      src: "",
      alt: "",
      label: "Latest event photos will appear here",
      className: latestPhotoCards.length === 0 ? "md:col-span-2 md:row-span-2" : "",
    });
  }
  const galleryItems: GalleryCard[] = [...latestPhotoCards, campusPhoto];
  const modalPhotos = galleryItems.filter((photo) => photo.src);

  useEffect(() => {
    document.body.style.overflow = selectedPhoto === null ? "" : "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPhoto(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedPhoto]);

  // Dynamically compute live house standings from DB or fallback
  const displayStandings = s?.standings?.length
    ? s.standings.map((team: any, i: number) => ({
        rank: i + 1,
        house: team.house,
        color: houseColors[team.house] || defaultColors[i % defaultColors.length],
        gold: team.gold || 0,
        silver: team.silver || 0,
        bronze: team.bronze || 0,
        points: team.points || 0,
      }))
    : (cfg?.houses || ["BCom Co-operation", "BA Economics", "BCom Finance & BBA", "GDA, BCA & Psychology"]).map((house: string, i: number) => ({
        rank: i + 1,
        house,
        color: houseColors[house] || defaultColors[i % defaultColors.length],
        gold: 0,
        silver: 0,
        bronze: 0,
        points: 0,
      }));

  // Published podiums are the default; admins can override them with featured cards.
  const liveWinners: DisplayWinner[] = [];
  if (s?.results && cfg?.events) {
    for (const [eid, r] of Object.entries<any>(s.results)) {
      const ev = cfg.events.find((e: any) => e.id === eid);
      if (ev && r.places?.length > 0) {
        const first = r.places[0];
        const teamEvent = ev.category === "Games" || /relay/i.test(`${ev.id} ${ev.name}`);
        liveWinners.push({
          event: ev.name,
          category: ev.gender === "Boys" ? "Men" : ev.gender === "Girls" ? "Women" : "Mixed",
          name: teamEvent ? `${first.house || first.name || first.id} Team` : first.name || first.id,
          house: teamEvent ? "" : first.house || "Team",
          result: "Winner",
          initials: (first.name || "W").slice(0, 2).toUpperCase(),
          accent: houseColors[first.house] || "#f47b00",
          picture: first.picture || "",
        });
      }
    }
  }
  const configuredWinners: DisplayWinner[] = (cfg?.featuredWinners || []).map((winner: any) => {
    const matchingResult = liveWinners.find(
      (live) =>
        live.event.trim().toLowerCase() === String(winner.event || "").trim().toLowerCase() &&
        live.name.trim().toLowerCase() === String(winner.name || "").trim().toLowerCase() &&
        live.house.trim().toLowerCase() === String(winner.house || "").trim().toLowerCase()
    );
    return {
      ...winner,
      initials: String(winner.name || "W").slice(0, 2).toUpperCase(),
      accent: houseColors[winner.house] || "#f47b00",
      result: winner.result || "Winner",
      picture: winner.picture || matchingResult?.picture || "",
    };
  });
  const displayWinners: DisplayWinner[] = configuredWinners.length ? configuredWinners : liveWinners;

  const filteredWinners: DisplayWinner[] =
    winnerFilter === "All"
      ? displayWinners
      : displayWinners.filter(
          (winner) =>
            winner.category === winnerFilter ||
            (winnerFilter === "Boys" && (winner.category === "Men" || winner.category === "Boys")) ||
            (winnerFilter === "Girls" && (winner.category === "Women" || winner.category === "Girls"))
        );

  const [eventCatFilter, setEventCatFilter] = useState<"All" | "Games" | "Athletics">("All");
  const [eventGenFilter, setEventGenFilter] = useState<"All" | "Boys" | "Girls">("All");

  const allEventsList = (cfg?.events && cfg.events.length > 0) ? cfg.events : SPORTSITEM_EVENTS;
  const filteredEventsList = allEventsList.filter((e: any) => {
    const matchCat = eventCatFilter === "All" || e.category === eventCatFilter;
    const matchGen =
      eventGenFilter === "All" ||
      e.gender === eventGenFilter ||
      (eventGenFilter === "Boys" && e.gender === "Men") ||
      (eventGenFilter === "Girls" && e.gender === "Women");
    return matchCat && matchGen;
  });

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fb] text-[#263948]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#002656]/10 bg-white/95 text-[#002656] shadow-sm backdrop-blur-xl">
        <div className="h-1 bg-gradient-to-r from-[#e63516] via-[#f47b00] to-[#f6a000]" />
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 md:px-10">
          <button
            onClick={() => scrollTo("home")}
            className="flex items-center gap-4 text-left"
            aria-label="Go to home"
          >
            <img
              src="/dcas-logo.png"
              alt="Duxford College for Advanced Studies"
              className="h-11 w-auto"
            />
            <span className="hidden border-l border-[#002656]/15 pl-4 sm:block">
              <span className="block text-[10px] font-extrabold uppercase leading-tight tracking-[.18em] text-[#f47b00]">
                Annual Sports & Games Meet 2026-27
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#002656]/55">DCAS 2026</span>
            </span>
          </button>
          <nav className="hidden items-center gap-8 lg:flex">
            {[...(scheduleItems.length ? ["Schedule"] : []), "Events", "Standings", "Winners", "Gallery"].map((item) => (
              <button
                key={item}
                onClick={() => scrollTo(item.toLowerCase())}
                className="text-xs font-bold uppercase tracking-[.14em] text-[#002656]/65 transition hover:text-[#f47b00]"
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <span className="flex items-center gap-2 rounded-full bg-[#fef1e5] px-4 py-2 text-xs font-semibold text-[#8f2000]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#f47b00]" /> Live · {cfg?.liveDay || "Day 2"}
            </span>
            <div className="relative">
              <button
                onClick={() => setUtilityOpen((open) => !open)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#002656]/15 text-xl font-black"
                aria-label="Open quick links"
              >
                ⋮
              </button>
              {utilityOpen && (
                <div className="absolute right-0 top-12 w-48 rounded-xl border border-[#002656]/10 bg-white p-2 shadow-xl">
                  <a className="block rounded-lg px-4 py-3 text-sm font-bold hover:bg-[#eef2f7]" href="#/results">Live Results</a>
                  <a className="block rounded-lg px-4 py-3 text-sm font-bold hover:bg-[#eef2f7]" href="#/points">My Points</a>
                  <a className="block rounded-lg px-4 py-3 text-sm font-bold hover:bg-[#eef2f7]" href="#/register">House Captain Login</a>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <span className="rounded-full bg-[#fef1e5] px-3 py-2 text-[10px] font-bold text-[#8f2000]">
              Live · {cfg?.liveDay || "Day 2"}
            </span>
            <button
              className="grid h-10 w-10 place-items-center"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-[#002656]/10 bg-white px-5 py-5 md:hidden">
            {[...(scheduleItems.length ? ["Schedule"] : []), "Events", "Standings", "Winners", "Gallery"].map((item) => (
              <button
                key={item}
                onClick={() => scrollTo(item.toLowerCase())}
                className="block w-full border-b border-[#002656]/10 py-4 text-left font-display text-2xl uppercase"
              >
                {item}
              </button>
            ))}
            <a href="#/results" className="block w-full border-b border-[#002656]/10 py-4 text-left font-display text-2xl uppercase">Live Results</a>
            <a href="#/points" className="block w-full border-b border-[#002656]/10 py-4 text-left font-display text-2xl uppercase">My Points</a>
            <a href="#/register" className="block w-full py-4 text-left font-display text-2xl uppercase">House Captain Login</a>
          </nav>
        )}
      </header>

      <section
        id="home"
        className="relative flex min-h-[820px] items-end bg-[#002656] pt-20 text-white"
      >
        <img
          src={heroPhoto}
          alt="Student athletes racing around a stadium track"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,38,86,.98)_0%,rgba(0,38,86,.78)_48%,rgba(0,38,86,.15)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#002656_0%,transparent_45%)]" />
        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-16 md:px-10 md:pb-20">
          <div className="max-w-4xl">
            <div className="mb-7 flex items-center gap-4">
              <span className="h-px w-12 bg-[#f47b00]" />
              <span className="text-xs font-bold uppercase tracking-[.28em] text-[#ffc067]">
                Duxford College for Advanced Studies
              </span>
            </div>
            <h1 className="font-display text-[clamp(5rem,13vw,11rem)] leading-[.74] uppercase tracking-[-.025em]">
              Rise. Run.
              <br />
              <span className="text-[#f47b00]">Reign.</span>
            </h1>
            <div className="mt-10 flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
              <p className="max-w-xl text-base leading-7 text-white/65 md:text-lg">
                Three days. Four houses. One unforgettable arena. Witness the speed, strength, and
                spirit of our campus come alive.
              </p>
              <button
                onClick={() => scrollTo("standings")}
                className="group flex shrink-0 items-center gap-4 self-start rounded-full border border-white/30 py-2 pl-6 pr-2 text-xs font-black uppercase tracking-[.16em] transition hover:bg-white hover:text-[#002656]"
              >
                Live standings{" "}
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f47b00] text-white transition group-hover:translate-x-1">
                  <Icon name="arrow" size={18} />
                </span>
              </button>
            </div>
          </div>
          <div className="mt-14 grid max-w-3xl grid-cols-3 border-t border-white/20 pt-6">
            {[
              ["30", "Events"],
              ["480+", "Athletes"],
              ["04", "Houses"],
            ].map(([number, label]) => (
              <div key={label} className="border-r border-white/15 pr-5 last:border-0 md:pr-12">
                <strong className="font-display text-4xl md:text-5xl">{number}</strong>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[.22em] text-white/50">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-16 right-10 hidden h-32 w-32 rotate-12 items-center justify-center rounded-full border border-white/25 text-center text-[10px] font-bold uppercase tracking-[.2em] text-white/60 xl:flex">
          Duxford
          <br />
          Sports
          <br />
          2026
        </div>
      </section>

      {/* Official Tournament Games & Athletics Directory */}
      <section id="events" className="border-t border-[#002656]/10 bg-[#edf1f7] py-24 md:py-32">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Complete Sports Roster</p>
              <h2 className="section-title mt-5">
                Tournament
                <br />
                Games & Items.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#59615e]">
                All <strong>30 officially recognized events</strong> across Games (10, 5, 2 pts) and Athletics (5, 3, 1 pts) partitioned into Boys and Girls divisions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#/register"
                className="rounded-full bg-[#f47b00] px-6 py-3 text-xs font-black uppercase tracking-[.14em] text-white transition hover:bg-[#e63516]"
              >
                House Captain Login →
              </a>
            </div>
          </div>

          {/* Interactive Filters */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Category Filter */}
            <div className="inline-flex rounded-full bg-[#dbe1ec] p-1.5 shadow-inner">
              {(["All", "Games", "Athletics"] as const).map((cat) => {
                const count = cat === "All" ? allEventsList.length : allEventsList.filter((e: any) => e.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setEventCatFilter(cat)}
                    className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-wider transition ${
                      eventCatFilter === cat ? "bg-[#002656] text-white shadow-sm" : "text-[#55606d] hover:text-[#002656]"
                    }`}
                  >
                    {cat === "Games" ? "⚽ Games" : cat === "Athletics" ? "🏃 Athletics" : "All Items"} ({count})
                  </button>
                );
              })}
            </div>

            {/* Gender Division Filter */}
            <div className="inline-flex rounded-full bg-white p-1.5 border border-[#002656]/15">
              {(["All", "Boys", "Girls"] as const).map((gen) => {
                const count = gen === "All" ? allEventsList.length : allEventsList.filter((e: any) => e.gender === gen).length;
                return (
                  <button
                    key={gen}
                    onClick={() => setEventGenFilter(gen)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                      eventGenFilter === gen ? "bg-[#f47b00] text-white" : "text-[#55606d] hover:text-[#002656]"
                    }`}
                  >
                    {gen === "Boys" ? "👦 Boys" : gen === "Girls" ? "👧 Girls" : "All Genders"} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Events Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEventsList.map((e: any) => {
              const pts = e.points || (e.category === "Games" ? [10, 5, 2] : [5, 3, 1]);
              const count = s?.counts?.[e.id] || 0;
              const isGame = e.category === "Games";
              const backgroundImage = eventBackgrounds[e.name] || eventBackgrounds.Athletics;

              return (
                <div
                  key={e.id}
                  className="group relative flex min-h-[310px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#002656] p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-25 transition duration-500 group-hover:scale-105 group-hover:opacity-35"
                    style={{ backgroundImage: `url("${backgroundImage}")` }}
                  />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#002656]/90 via-[#002656]/75 to-[#002656]/90" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${
                        isGame ? "bg-[#e8f1ff] text-[#002656]" : "bg-[#fef1e5] text-[#b84d00]"
                      }`}>
                        {e.category}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white">
                        {e.gender}
                      </span>
                    </div>

                    <div className="my-5">
                      <h3 className="text-2xl font-extrabold leading-tight text-white">{e.name}</h3>
                      <span className="mt-1 inline-block text-xs font-semibold uppercase tracking-wider text-white/65">{e.type}</span>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/15 bg-white/10 p-3">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">
                        Predefined Points Scale
                      </span>
                      <div className="flex items-center justify-between gap-2 text-xs font-black text-white">
                        <span>1st: {pts[0]}</span>
                        <span>2nd: {pts[1]}</span>
                        <span>3rd: {pts[2]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 mt-5 flex items-center justify-between border-t border-white/20 pt-3">
                    <span className="text-xs font-semibold text-white/65">
                      {count} {count === 1 ? "entry" : "entries"} registered
                    </span>
                    <a
                      href="#/register"
                      className="text-xs font-black uppercase tracking-wider text-[#f47b00] hover:text-[#e63516] transition"
                    >
                      Register →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {scheduleItems.length > 0 && (
        <section id="schedule" className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10">
            <div className="mb-10">
              <p className="eyebrow">Plan your meet</p>
              <h2 className="section-title mt-5">Event schedule.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#626c79]">
                Check event times, divisions, and locations for the sports meet.
              </p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[#002656]/10">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-[#002656] text-[10px] font-bold uppercase tracking-[.16em] text-white/70">
                  <tr>
                    <th className="px-5 py-4">Day</th>
                    <th className="px-5 py-4">Time</th>
                    <th className="px-5 py-4">Event</th>
                    <th className="px-5 py-4">Category / Division</th>
                    <th className="px-5 py-4">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#002656]/10">
                  {scheduleItems.map((item: any, index: number) => (
                    <tr key={`${item.day}-${item.time}-${item.event}-${index}`} className="text-sm text-[#263948]">
                      <td className="whitespace-nowrap px-5 py-4 font-bold">{item.day}</td>
                      <td className="whitespace-nowrap px-5 py-4">{item.time}</td>
                      <td className="px-5 py-4 font-semibold">{item.event}</td>
                      <td className="px-5 py-4 text-[#626c79]">
                        {[item.category, item.gender].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-5 py-4">{item.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section id="standings" className="bg-[#0d2553] py-24 text-white md:py-32">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-[#ffad4a]">Championship race</p>
              <h2 className="section-title mt-5">Point table.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-white/50">
              Updated live ({s?.published || 0} of {cfg?.events?.length || 30} events published). Standings reflect both Athletics & Games points.
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[70px_1fr_repeat(3,90px)_110px] border-b border-white/20 px-4 pb-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/40">
                <span>Rank</span>
                <span>House</span>
                <span>Gold</span>
                <span>Silver</span>
                <span>Bronze</span>
                <span className="text-right">Points</span>
              </div>
              {displayStandings.map((team: any) => (
                <div
                  key={team.house}
                  className="grid grid-cols-[70px_1fr_repeat(3,90px)_110px] items-center border-b border-white/12 px-4 py-7 transition hover:bg-white/5"
                >
                  <span className="font-display text-3xl text-white/35">0{team.rank}</span>
                  <div className="flex items-center gap-4">
                    <span className="h-10 w-2 rounded-full" style={{ background: team.color }} />
                    <strong className="text-lg">{team.house}</strong>
                  </div>
                  <span>{team.gold}</span>
                  <span>{team.silver}</span>
                  <span>{team.bronze}</span>
                  <span className="text-right font-display text-4xl" style={{ color: team.color }}>
                    {team.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="winners" className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
        <div className="mb-12 flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Hall of effort</p>
            <h2 className="section-title mt-5">Event winners.</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", "Boys", "Girls"].map((filter) => (
              <button
                key={filter}
                onClick={() => setWinnerFilter(filter)}
                className={`rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wider transition ${winnerFilter === filter ? "bg-[#f47b00] text-white" : "border border-[#c8c4ba] hover:border-[#f47b00]"}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-px overflow-hidden border border-[#cbc7bd] bg-[#cbc7bd] md:grid-cols-2 xl:grid-cols-3">
          {filteredWinners.length === 0 ? (
            <div className="bg-white p-8 text-sm text-[#737875] md:col-span-2 xl:col-span-3">
              Event winners will appear here when an administrator publishes results or adds featured winners.
            </div>
          ) : filteredWinners.map((winner) => (
            <article
              key={winner.event + winner.name}
              className="group min-h-72 bg-[#f7f8fb] p-7 transition hover:bg-white"
            >
              <div className="flex items-start justify-between">
                <span className="rounded-full border border-[#cbc7bd] px-3 py-1 text-[10px] font-black uppercase tracking-[.15em]">
                  {winner.category}
                </span>
                <Icon name="trophy" size={28} />
              </div>
              <div className="mt-10 flex items-end gap-5">
                {winner.picture ? (
                  <img
                    src={winner.picture}
                    alt={`${winner.name} portrait`}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-full object-cover ring-4 ring-white shadow-md"
                  />
                ) : (
                  <div
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-full font-display text-2xl text-[#002656]"
                    style={{ background: winner.accent }}
                  >
                    {winner.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-[#737875]">
                    {winner.event}
                  </p>
                  <h3 className="mt-1 break-words text-xl font-extrabold leading-tight">{winner.name}</h3>
                  {winner.house && <p className="mt-1 break-words text-sm text-[#737875]">{winner.house} House</p>}
                </div>
              </div>
              <div
                className="mt-6 flex justify-end font-display text-3xl"
                style={{ color: winner.accent }}
              >
                {winner.result}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="gallery" className="bg-[#eef2f7] py-24 md:py-32">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <p className="eyebrow">Captured in motion</p>
              <h2 className="section-title mt-5">Meet gallery.</h2>
            </div>
            <p className="hidden text-xs font-bold uppercase tracking-[.2em] text-[#6c716d] md:block">
              Live gallery / {galleryData?.photos?.length ?? cfg?.gallery?.length ?? 0} event photos
            </p>
          </div>
          <div className="grid auto-rows-[240px] gap-4 md:grid-cols-4">
            {galleryItems.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => {
                  const modalIndex = modalPhotos.findIndex((item) => item.id === photo.id);
                  if (modalIndex >= 0) {
                    if (photo.id !== "our-campus" && photo.src && !photo.id.startsWith("latest-photo-placeholder")) {
                      trackGalleryActivity(photo.id, "open");
                    }
                    setSelectedPhoto(modalIndex);
                  }
                }}
                disabled={!photo.src}
                aria-label={photo.src ? `View ${photo.label}` : photo.label}
                className={`group relative overflow-hidden bg-[#002656] text-left ${photo.className}`}
              >
                {photo.src ? (
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105 group-hover:opacity-75"
                  />
                ) : (
                  <div className="grid h-full min-h-[240px] place-items-center border border-dashed border-white/25 px-6 text-center text-sm text-white/65">
                    {photo.label}
                  </div>
                )}
                {photo.src && (
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-5 pt-16 text-white">
                  <span className="font-display text-2xl uppercase">{photo.label}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/60 transition group-hover:bg-white group-hover:text-black">
                    <Icon name="arrow" size={16} />
                  </span>
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-[#d6dce5] pt-6 sm:flex-row sm:items-center">
            <p className="max-w-xl text-sm leading-6 text-[#626c79]">
              Browse the complete event photo collection and download any image you need.
            </p>
            <a href="#/gallery" className="inline-flex items-center gap-2 rounded-full bg-[#002656] px-6 py-3 text-xs font-bold uppercase tracking-[.14em] text-white transition hover:bg-[#f47b00]">
              Browse full gallery <Icon name="arrow" size={16} />
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-[#002656] px-5 py-14 text-white md:px-10">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col justify-between gap-10 border-b border-white/15 pb-12 md:flex-row">
            <div>
              <img
                src="/dcas-logo.png"
                alt="Duxford College for Advanced Studies"
                className="h-14 w-auto rounded-sm bg-white px-3 py-2"
              />
              <p className="mt-5 font-display text-3xl">DCAS SPORTS MEET ’26</p>
              <p className="mt-3 max-w-sm text-sm leading-6 text-white/45">
                Duxford College Annual Sports Meet. Built on grit, teamwork, and the courage to go
                further.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
              {[...(scheduleItems.length ? ["Schedule"] : []), "Standings", "Winners", "Gallery"].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollTo(item.toLowerCase())}
                  className="text-left text-white/60 transition hover:text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 pt-7 text-[10px] font-bold uppercase tracking-[.16em] text-white/35 md:flex-row">
            <p>© 2026 Duxford College for Advanced Studies</p>
            <p>Campus imagery courtesy of DCAS {/*· Sports photography via Unsplash */}</p>
          </div>
          <p className="mt-5 text-center text-xs font-semibold tracking-wide text-white/55">
            Developed by <a href="https://muhammedthajudheen.me" target="_blank" rel="noopener noreferrer" className="text-white/55 underline hover:text-white">
              Muhammed Thajdheen
            </a>
          </p>
        </div>
      </footer>

      {selectedPhoto !== null && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#002656]/95 p-4 md:p-12"
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image"
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-full border border-white/30 text-white transition hover:bg-white hover:text-black"
            aria-label="Close gallery"
          >
            <Icon name="close" />
          </button>
          <figure className="max-h-full max-w-6xl">
            <img
              src={modalPhotos[selectedPhoto].src}
              alt={modalPhotos[selectedPhoto].alt}
              className="max-h-[80vh] w-auto object-contain"
            />
            <figcaption className="mt-4 flex items-center justify-between text-white">
              <span className="font-display text-2xl uppercase">{modalPhotos[selectedPhoto].label}</span>
              <span className="text-xs text-white/50">
                {String(selectedPhoto + 1).padStart(2, "0")} / {String(modalPhotos.length).padStart(2, "0")}
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </main>
  );
}

export default App;
