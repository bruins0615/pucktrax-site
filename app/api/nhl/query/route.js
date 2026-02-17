const TIMEFRAMES = new Set(["last5", "last10", "season", "lastseason"]);
const STAT_MAP = {
  shots: ["sog", "shots", "shotsOnGoal"],
  goals: ["goals"],
  assists: ["assists"],
  points: ["points"],
  toi: ["toi", "timeOnIce"], // may need parsing
};

function pick(obj, keys) {
  for (const k of keys) if (obj?.[k] != null) return obj[k];
  return null;
}

function toNumber(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    // handle TOI like "17:34"
    if (v.includes(":")) {
      const [m, s] = v.split(":").map(Number);
      if (!Number.isNaN(m) && !Number.isNaN(s)) return m * 60 + s;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId || "").trim();
  const timeframe = String(body.timeframe || "last10");
  const opponent = (body.opponent || "").toString().trim().toUpperCase(); // e.g. "TBL"
  const stats = Array.isArray(body.stats) ? body.stats : ["shots"];

  if (!playerId) return Response.json({ error: "Missing playerId" }, { status: 400 });
  if (!TIMEFRAMES.has(timeframe)) return Response.json({ error: "Invalid timeframe" }, { status: 400 });

  // NHL player game log
  const url = `https://api-web.nhle.com/v1/player/${encodeURIComponent(playerId)}/game-log/now`;
  const r = await fetch(url, {
    // Cache: short for recent, longer for season-ish
    next: { revalidate: timeframe.startsWith("last") ? 600 : 21600 },
  });

  if (!r.ok) return Response.json({ error: "Upstream game log failed" }, { status: 502 });
  const data = await r.json();

  // The endpoint returns a blob; game list is typically under a property like `gameLog`
  const gameLog = data?.gameLog || data?.games || data?.gameLogs || [];
  const player = {
    id: playerId,
    name: data?.playerName || data?.name || data?.fullName || "",
    team: data?.teamAbbrev || data?.currentTeamAbbrev || "",
    position: data?.position || "",
  };

  let games = Array.isArray(gameLog) ? gameLog : [];

  // Timeframe: for MVP “last5/last10” = most recent N overall games
  if (timeframe === "last5") games = games.slice(0, 5);
  if (timeframe === "last10") games = games.slice(0, 10);

  // Optional opponent filter (after timeframe slicing)
  if (opponent) {
    games = games.filter(g => {
      const opp = (g?.opponentAbbrev || g?.oppAbbrev || g?.opponent || "").toString().toUpperCase();
      return opp === opponent;
    });
  }

  // Compute totals for selected stats
  const totals = {};
  for (const s of stats) {
    const keys = STAT_MAP[s] || [s];
    totals[s] = games.reduce((sum, g) => sum + toNumber(pick(g, keys)), 0);
  }

  // Normalize games for UI
  const normalizedGames = games.map(g => ({
    date: g?.gameDate || g?.date || "",
    opponent: g?.opponentAbbrev || g?.oppAbbrev || g?.opponent || "",
    isHome: g?.homeRoad === "H" ? true : g?.homeRoad === "R" ? false : (g?.isHome ?? null),
    stats: Object.fromEntries(stats.map(s => [s, toNumber(pick(g, STAT_MAP[s] || [s]))])),
  }));

  return Response.json({
    player,
    filters: { timeframe, opponent: opponent || null, stats },
    summary: { games: normalizedGames.length, totals },
    games: normalizedGames,
  });
}