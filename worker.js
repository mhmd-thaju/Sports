export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    if (incoming.pathname.startsWith("/api/")) {
      if (!env.API_ORIGIN) {
        return Response.json({ error: "API_ORIGIN is not configured for this Worker." }, { status: 503 });
      }

      let apiOrigin;
      try {
        apiOrigin = new URL(env.API_ORIGIN);
      } catch {
        return Response.json({ error: "API_ORIGIN must be a valid HTTPS URL." }, { status: 500 });
      }

      if (apiOrigin.protocol !== "https:") {
        return Response.json({ error: "API_ORIGIN must use HTTPS." }, { status: 500 });
      }

      const upstream = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);
      return fetch(new Request(upstream, request));
    }

    return env.ASSETS.fetch(request);
  },
};
