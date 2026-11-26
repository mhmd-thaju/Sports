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
import Animation from "./pages/Animation";
import { getPendingApiRequests } from "./api";

const pages: Record<string, ComponentType> = { "": Home, register: Register, results: Results, points: Points, judge: Judge, admin: Admin, poster: Poster, gallery: Gallery, "media-upload": MediaUpload, animation: Animation };
const current = () => location.hash
  ? location.hash.replace(/^#\/?/, "")
  : location.pathname.replace(/^\/+|\/+$/g, "");

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
      <ApiLoadingIndicator />
      {route === "" || route === "animation" ? <Page /> : <div className="page"><a className="back" href="#/">← DCAS Sports Meet</a><Page /></div>}
    </>
  );
}

function ApiLoadingIndicator() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let pending = getPendingApiRequests();
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const onStart = () => {
      pending += 1;
      if (hideTimer) clearTimeout(hideTimer);
      if (!showTimer && !visible) {
        showTimer = setTimeout(() => {
          if (pending > 0) setVisible(true);
          showTimer = undefined;
        }, 220);
      }
    };
    const onEnd = () => {
      pending = Math.max(0, pending - 1);
      if (pending === 0) {
        if (showTimer) clearTimeout(showTimer);
        showTimer = undefined;
        hideTimer = setTimeout(() => setVisible(false), 180);
      }
    };
    window.addEventListener("sportsmeet:api:start", onStart);
    window.addEventListener("sportsmeet:api:end", onEnd);
    if (pending > 0) {
      showTimer = setTimeout(() => {
        if (pending > 0) setVisible(true);
        showTimer = undefined;
      }, 220);
    }
    return () => {
      window.removeEventListener("sportsmeet:api:start", onStart);
      window.removeEventListener("sportsmeet:api:end", onEnd);
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  return visible ? (
    <div className="api-loading-indicator" role="status" aria-label="Syncing with the server">
      <span className="api-loading-indicator__pill">
        <span className="api-loading-indicator__spinner" aria-hidden="true" />
        Syncing live data
      </span>
    </div>
  ) : null;
}
