import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * Fetches a path, refreshes it every `ms` milliseconds,
 * and immediately invalidates and re-fetches when any action occurs (via 'sportsmeet:refresh').
 */
export function usePoll<T = any>(path: string, ms = 5000, pin?: string, judge?: string): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    let on = true;
    const load = () => {
      api(path, undefined, pin, judge)
        .then((d) => {
          if (on) setData(d);
        })
        .catch(() => {});
    };

    load();
    const t = setInterval(load, ms);

    const handleRefresh = () => {
      load();
    };

    window.addEventListener("sportsmeet:refresh", handleRefresh);

    return () => {
      on = false;
      clearInterval(t);
      window.removeEventListener("sportsmeet:refresh", handleRefresh);
    };
  }, [path, ms, pin, judge]);

  return data;
}
