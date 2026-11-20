import { useEffect, useState, type ComponentType } from "react";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Results from "./pages/Results";
import Points from "./pages/Points";
import Judge from "./pages/Judge";
import Admin from "./pages/Admin";
import Poster from "./pages/Poster";

const pages: Record<string, ComponentType> = { "": Home, register: Register, results: Results, points: Points, judge: Judge, admin: Admin, poster: Poster };
const current = () => location.hash.replace(/^#\/?/, "");

export default function App() {
  const [route, setRoute] = useState(current());
  useEffect(() => {
    const on = () => { setRoute(current()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const Page = pages[route] || Home;
  return (
    <>
      {route === "" ? <Page /> : <div className="page"><a className="back" href="#/">← DCAS Sports Meet</a><Page /></div>}
      <BottomNav route={route} />
    </>
  );
}
