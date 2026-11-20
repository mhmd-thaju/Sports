import { useEffect, useState } from "react";
import { api } from "./api";

/** Fetches a path and refreshes it every `ms` milliseconds (live results). */
export function usePoll<T = any>(path: string, ms = 5000): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let on = true;
    const load = () => api(path).then((d) => on && setData(d)).catch(() => {});
    load();
    const t = setInterval(load, ms);
    return () => { on = false; clearInterval(t); };
  }, [path, ms]);
  return data;
}
