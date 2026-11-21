import { useEffect, useState, type ComponentType } from "react";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Results from "./pages/Results";
import Points from "./pages/Points";
import Judge from "./pages/Judge";
import Admin from "./pages/Admin";
import Poster from "./pages/Poster";
import Gallery from "./pages/Gallery";
import MediaUpload from "./pages/MediaUpload";

const pages: Record<string, ComponentType> = { "": Home, register: Register, results: Results, points: Points, judge: Judge, admin: Admin, poster: Poster, gallery: Gallery, "media-upload": MediaUpload };
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
    </>
  );
}
