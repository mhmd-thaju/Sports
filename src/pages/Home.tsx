import { useEffect, useState } from "react";

const photos = [
  {
    src: "https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=1600&q=85",
    alt: "Student athletes racing around a stadium track",
    label: "Track Finals",
    className: "md:col-span-2 md:row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1532444458054-01a7dd3e9fca?auto=format&fit=crop&w=1000&q=85",
    alt: "Athletes sprinting together on a track",
    label: "100m Sprint",
    className: "",
  },
  {
    src: "https://images.unsplash.com/photo-1457470572216-1240fac24b37?auto=format&fit=crop&w=1000&q=85",
    alt: "Low angle view across a running track",
    label: "The Arena",
    className: "",
  },
  {
    src: "/dcas-campus.jpg",
    alt: "Aerial view of the Duxford College campus and sports ground",
    label: "Our Campus",
    className: "md:col-span-2",
  },
];

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

const winners = [
  {
    event: "100m Sprint",
    category: "Men",
    name: "Arjun Mehta",
    house: "Falcon",
    result: "10.82s",
    initials: "AM",
    accent: "#f47b00",
  },
  {
    event: "High Jump",
    category: "Women",
    name: "Riya Kapoor",
    house: "Phoenix",
    result: "1.72m",
    initials: "RK",
    accent: "#f5c84b",
  },
  {
    event: "400m Relay",
    category: "Mixed",
    name: "Falcon Quartet",
    house: "Falcon",
    result: "43.19s",
    initials: "F4",
    accent: "#f47b00",
  },
  {
    event: "Long Jump",
    category: "Men",
    name: "Kabir Singh",
    house: "Titan",
    result: "7.14m",
    initials: "KS",
    accent: "#1db8a3",
  },
  {
    event: "Badminton",
    category: "Women",
    name: "Meera Joshi",
    house: "Spartan",
    result: "21–16",
    initials: "MJ",
    accent: "#6e8bf5",
  },
  {
    event: "Basketball",
    category: "Men",
    name: "Phoenix Five",
    house: "Phoenix",
    result: "68–61",
    initials: "P5",
    accent: "#f5c84b",
  },
];

const schedules = {
  "Day 1": [
    {
      time: "08:00",
      event: "March Past & Opening Ceremony",
      venue: "Main Field",
      type: "Ceremony",
    },
    { time: "09:30", event: "100m & 200m Heats", venue: "Athletics Track", type: "Track" },
    { time: "11:00", event: "Volleyball Group Stage", venue: "Indoor Court", type: "Team" },
    { time: "13:30", event: "Shot Put Qualifiers", venue: "Field Arena", type: "Field" },
    { time: "15:00", event: "800m Heats", venue: "Athletics Track", type: "Track" },
  ],
  "Day 2": [
    { time: "08:00", event: "Athlete Warm-up Session", venue: "Main Field", type: "Completed" },
    { time: "09:30", event: "100m & 200m Finals", venue: "Athletics Track", type: "Track" },
    { time: "11:00", event: "Basketball Semi-finals", venue: "Indoor Court", type: "Team" },
    { time: "13:30", event: "Long Jump Finals", venue: "Field Arena", type: "Field" },
    { time: "15:00", event: "4 × 400m Relay Finals", venue: "Athletics Track", type: "Track" },
  ],
  "Day 3": [
    { time: "09:00", event: "Badminton Finals", venue: "Sports Hall", type: "Team" },
    { time: "10:30", event: "High Jump Finals", venue: "Field Arena", type: "Field" },
    { time: "12:00", event: "Football Championship", venue: "Main Field", type: "Team" },
    { time: "15:00", event: "House Relay Showdown", venue: "Athletics Track", type: "Track" },
    { time: "17:00", event: "Medal Ceremony", venue: "Main Field", type: "Ceremony" },
  ],
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [winnerFilter, setWinnerFilter] = useState("All");
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<keyof typeof schedules>("Day 2");

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

  const filteredWinners =
    winnerFilter === "All"
      ? winners
      : winners.filter(
          (winner) =>
            winner.category === winnerFilter ||
            (winnerFilter === "Boys" && winner.category === "Men") ||
            (winnerFilter === "Girls" && winner.category === "Women")
        );

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
                Annual Sports Meet
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#002656]/55">DCAS 2026</span>
            </span>
          </button>
          <nav className="hidden items-center gap-8 lg:flex">
            {["Schedule", "Standings", "Winners", "Gallery"].map((item) => (
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
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#f47b00]" /> Live · Day 2
            </span>
            <button
              onClick={() => scrollTo("schedule")}
              className="rounded-full bg-[#f47b00] px-5 py-2.5 text-xs font-black uppercase tracking-[.12em] text-white transition hover:bg-[#e63516]"
            >
              View events
            </button>
          </div>
          <button
            className="grid h-10 w-10 place-items-center md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-[#002656]/10 bg-white px-5 py-5 md:hidden">
            {["Schedule", "Standings", "Winners", "Gallery"].map((item) => (
              <button
                key={item}
                onClick={() => scrollTo(item.toLowerCase())}
                className="block w-full border-b border-[#002656]/10 py-4 text-left font-display text-2xl uppercase"
              >
                {item}
              </button>
            ))}
          </nav>
        )}
      </header>

      <section
        id="home"
        className="relative flex min-h-[820px] items-end bg-[#002656] pt-20 text-white"
      >
        <img
          src={photos[0].src}
          alt={photos[0].alt}
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
              ["32", "Events"],
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

      <section id="schedule" className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
        <div className="grid gap-14 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="eyebrow">Up next</p>
            <h2 className="section-title mt-5">
              Today’s
              <br />
              line-up.
            </h2>
            <p className="mt-7 max-w-sm leading-7 text-[#59615e]">
              The arena is ready. Follow every heat, match, and medal moment from day two.
            </p>
            <div className="mt-10 inline-flex rounded-full bg-[#e7e2d7] p-1.5">
              {["Day 1", "Day 2", "Day 3"].map((day) => (
                <button
                  key={day}
                  onClick={() => setActiveDay(day as keyof typeof schedules)}
                  className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-wider ${day === activeDay ? "bg-[#002656] text-white" : "text-[#6b706e]"}`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t-2 border-[#002656]">
            {schedules[activeDay].map((item) => (
              <div
                key={item.time}
                className="group grid grid-cols-[60px_1fr] gap-4 border-b border-[#cbc8bf] py-6 transition hover:px-4 md:grid-cols-[90px_1fr_120px] md:items-center"
              >
                <span className="font-display text-xl text-[#f47b00]">{item.time}</span>
                <div>
                  <p className="text-base font-extrabold md:text-lg">{item.event}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#737875]">
                    <Icon name="map" size={13} />
                    {item.venue}
                  </p>
                </div>
                <span className="col-start-2 w-fit rounded-full border border-[#c6c4bb] px-3 py-1 text-[10px] font-bold uppercase tracking-[.15em] text-[#676d69] md:col-start-auto">
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="standings" className="bg-[#0d2553] py-24 text-white md:py-32">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-[#ffad4a]">Championship race</p>
              <h2 className="section-title mt-5">Point table.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-white/50">
              Updated after 24 of 32 events. Points include track, field, team sports, and
              participation bonuses.
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
              {standings.map((team) => (
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
          {filteredWinners.map((winner) => (
            <article
              key={winner.event + winner.name}
              className="group relative min-h-72 bg-[#f7f8fb] p-7 transition hover:bg-white"
            >
              <div className="flex items-start justify-between">
                <span className="rounded-full border border-[#cbc7bd] px-3 py-1 text-[10px] font-black uppercase tracking-[.15em]">
                  {winner.category}
                </span>
                <Icon name="trophy" size={28} />
              </div>
              <div className="mt-10 flex items-end gap-5">
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-full font-display text-2xl text-[#002656]"
                  style={{ background: winner.accent }}
                >
                  {winner.initials}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-[#737875]">
                    {winner.event}
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold">{winner.name}</h3>
                  <p className="mt-1 text-sm text-[#737875]">{winner.house} House</p>
                </div>
              </div>
              <div
                className="absolute bottom-6 right-7 font-display text-3xl"
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
              Day 01—02 / 48 photos
            </p>
          </div>
          <div className="grid auto-rows-[240px] gap-4 md:grid-cols-4">
            {photos.map((photo, index) => (
              <button
                key={photo.src}
                onClick={() => setSelectedPhoto(index)}
                className={`group relative overflow-hidden bg-[#002656] text-left ${photo.className}`}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105 group-hover:opacity-75"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-5 pt-16 text-white">
                  <span className="font-display text-2xl uppercase">{photo.label}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/60 transition group-hover:bg-white group-hover:text-black">
                    <Icon name="arrow" size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f47b00] px-5 py-20 text-[#002656] md:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 md:flex-row md:items-center">
          <h2 className="font-display text-6xl uppercase leading-[.85] md:text-8xl">
            Bring the noise.
            <br />
            Back your house.
          </h2>
          <div className="max-w-sm">
            <p className="font-semibold leading-7">
              Finals begin Saturday at 3:00 PM. Wear your house colors and fill the stands.
            </p>
            <div className="mt-6 flex gap-6 text-xs font-black uppercase tracking-[.15em]">
              <span className="flex items-center gap-2">
                <Icon name="calendar" size={16} /> Finals Day
              </span>
              <span className="flex items-center gap-2">
                <Icon name="clock" size={16} /> 3:00 PM
              </span>
            </div>
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
              {["Schedule", "Standings", "Winners", "Gallery"].map((item) => (
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
            <p>Campus imagery courtesy of DCAS · Sports photography via Unsplash</p>
          </div>
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
              src={photos[selectedPhoto].src}
              alt={photos[selectedPhoto].alt}
              className="max-h-[80vh] w-auto object-contain"
            />
            <figcaption className="mt-4 flex items-center justify-between text-white">
              <span className="font-display text-2xl uppercase">{photos[selectedPhoto].label}</span>
              <span className="text-xs text-white/50">
                0{selectedPhoto + 1} / 0{photos.length}
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </main>
  );
}

export default App;
