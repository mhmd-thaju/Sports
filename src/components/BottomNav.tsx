const links = [
  ["", "Home"],
  ["register", "Register"],
  ["results", "Live Results"],
  ["points", "My Points"],
  ["admin", "Admin Desk"],
];

export default function BottomNav({ route }: { route: string }) {
  return (
    <nav className="bnav" aria-label="Main">
      {links.map(([r, label]) => (
        <a key={r} href={"#/" + r} className={route === r ? "on" : ""}>
          {label}
        </a>
      ))}
    </nav>
  );
}
