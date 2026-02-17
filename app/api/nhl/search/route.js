export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return Response.json({ players: [] });
  }

  const url = new URL("https://search.d3.nhle.com/api/v1/search/player");
  url.searchParams.set("culture", "en-us");
  url.searchParams.set("limit", "20");
  url.searchParams.set("q", q);

  const r = await fetch(url.toString(), {
    // Cache results briefly so typing doesn't spam upstream
    next: { revalidate: 3600 },
  });

  if (!r.ok) {
    return Response.json({ players: [], error: "Search failed" }, { status: 502 });
  }

  const data = await r.json();

  // Normalize to a stable shape for the UI
  const players = (Array.isArray(data) ? data : data?.results || data?.players || []).map((p) => ({
    id: String(p.playerId ?? p.id ?? p.player_id ?? ""),
    name: p.name ?? p.fullName ?? p.playerName ?? "",
    team: p.teamAbbrev ?? p.team ?? p.teamCode ?? "",
    position: p.position ?? p.pos ?? "",
  })).filter(p => p.id && p.name);

  return Response.json({ players });
}