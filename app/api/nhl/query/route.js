const TIMEFRAMES = new Set(["last5", "last10", "season", "lastseason"]);
const STAT_MAP = {
  // Skater basics
  shots: ["shots"],
  goals: ["goals"],
  assists: ["assists"],
  points: ["points"],
  plusMinus: ["plusMinus"],
  pim: ["pim"],
  toi: ["toi"],

  // Skater scoring detail
  powerPlayGoals: ["powerPlayGoals"],
  powerPlayPoints: ["powerPlayPoints"],
  gameWinningGoals: ["gameWinningGoals"],
  otGoals: ["otGoals"],
  shorthandedGoals: ["shorthandedGoals"],
  shorthandedPoints: ["shorthandedPoints"],
  shifts: ["shifts"],

  // Goalie
  gamesStarted: ["gamesStarted"],
  shotsAgainst: ["shotsAgainst"],
  goalsAgainst: ["goalsAgainst"],
  savePctg: ["savePctg"],
  shutouts: ["shutouts"],
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
function getCurrentNhlSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // Jan = 1

  // NHL season rolls over in summer
  if (month >= 7) {
    return `${year}${year + 1}`;
  }

  return `${year - 1}${year}`;
}

function toiToSeconds(toi) {
  if (!toi || typeof toi !== "string") return 0;
  const [mins, secs] = toi.split(":").map(Number);
  return mins * 60 + secs;
}

function secondsToToi(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatSavePctg(value) {
  if (value == null || Number.isNaN(Number(value))) return ".000";
  return Number(value).toFixed(3).replace(/^0/, "");
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId || "").trim();
  const timeframe = String(body.timeframe || "last10");
  const opponent = (body.opponent || "").toString().trim().toUpperCase(); // e.g. "TBL"
  const stats = Array.isArray(body.stats) ? body.stats : ["shots"];

  if (!playerId) return Response.json({ error: "Missing playerId" }, { status: 400 });
  if (!TIMEFRAMES.has(timeframe)) return Response.json({ error: "Invalid timeframe" }, { status: 400 });

  // NHL player game logs: regular season + playoffs
  const season = getCurrentNhlSeason();

  const regularUrl = `https://api-web.nhle.com/v1/player/${encodeURIComponent(playerId)}/game-log/${season}/2`;
  const playoffUrl = `https://api-web.nhle.com/v1/player/${encodeURIComponent(playerId)}/game-log/${season}/3`;

  const [regularRes, playoffRes] = await Promise.all([
    fetch(regularUrl, {
      next: { revalidate: timeframe.startsWith("last") ? 600 : 21600 },
    }),
    fetch(playoffUrl, {
      next: { revalidate: timeframe.startsWith("last") ? 600 : 21600 },
    }),
  ]);

  const regularData = regularRes.ok ? await regularRes.json() : {};
  const playoffData = playoffRes.ok ? await playoffRes.json() : {};

  // Extract game arrays from both responses
  const regularGames =
    regularData?.gameLog || regularData?.games || regularData?.gameLogs || [];

  const playoffGames =
    playoffData?.gameLog || playoffData?.games || playoffData?.gameLogs || [];

  // Combine them
  let games = [...playoffGames, ...regularGames];

  // Sort newest → oldest
  games.sort((a, b) => {
    const aDate = new Date(a?.gameDate || a?.date || 0);
    const bDate = new Date(b?.gameDate || b?.date || 0);
    return bDate - aDate;
  });

  console.log("FIRST GAME OBJECT:", games[0]);

  // Build player object (use whichever response has data)
  const playerSource =
    regularData?.playerName || regularData?.name || regularData?.fullName
      ? regularData
      : playoffData;

  const player = {
    id: playerId,
    name: playerSource?.playerName || playerSource?.name || playerSource?.fullName || "",
    team: playerSource?.teamAbbrev || playerSource?.currentTeamAbbrev || "",
    position: playerSource?.position || "",
  };

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

  const total = games.reduce((sum, g) => {
    const value = pick(g, keys);

    if (s === "toi") {
      return sum + toiToSeconds(value);
    }

    return sum + toNumber(value);
  }, 0);

  if (s === "toi") {
    totals[s] = secondsToToi(total);
  } else if (s === "savePctg") {
    totals[s] = games.length > 0 ? formatSavePctg(total / games.length) : ".000";
  } else {
    totals[s] = total;
  }
}

  // Normalize games for UI
  const normalizedGames = games.map(g => ({
    date: g?.gameDate || g?.date || "",
    opponent: g?.opponentAbbrev || g?.oppAbbrev || g?.opponent || "",
    isHome: g?.homeRoad === "H" ? true : g?.homeRoad === "R" ? false : (g?.isHome ?? null),
    stats: Object.fromEntries(stats.map(s => {
      const value = pick(g, STAT_MAP[s] || [s]);
      
    if (s === "toi") {
      return [s, value || "0:00"];
    }

    if (s === "savePctg") {
      return [s, formatSavePctg(value)];
    }

    return [s, toNumber(value)];
    })
  ),
  }));

  return Response.json({
    player,
    filters: { timeframe, opponent: opponent || null, stats },
    summary: { games: normalizedGames.length, totals },
    games: normalizedGames,
  });
}