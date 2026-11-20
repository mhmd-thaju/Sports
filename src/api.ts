export async function api(path: string, body?: unknown, pin?: string, judge?: string) {
  const r = await fetch("/api" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(pin ? { "x-pin": pin } : {}), ...(judge ? { "x-judge": judge } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
  return j;
}
