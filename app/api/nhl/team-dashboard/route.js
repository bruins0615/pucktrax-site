function getCurrentNhlSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // NHL season rolls over in summer
  if (month >= 7) {
    return `${year}${year + 1}`;
  }

  return `${year - 1}${year}`;
}

function getTeamDisplayName(rosterData, team) {
  const firstPlayer =
    rosterData?.forwards?.[0] ||
    rosterData?.defensemen?.[0] ||
    rosterData?.goalies?.[0];

  return firstPlayer?.teamName?.default || team;
}

function formatRecentGames(scheduleData, team) {
  const games = scheduleData?.games || [];

  const completed = games.filter((g) => g?.gameState === "OFF");

  completed.sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));

  return completed.slice(0, 5).map((g) => {
    const homeAbbrev =
      g?.homeTeam?.abbrev?.default || g?.homeTeam?.abbrev || "";
    const awayAbbrev =
      g?.awayTeam?.abbrev?.default || g?.awayTeam?.abbrev || "";

    const isHome = homeAbbrev === team;

    const opponent = isHome ? awayAbbrev : homeAbbrev;
    const teamScore = isHome ? g?.homeTeam?.score : g?.awayTeam?.score;
    const opponentScore = isHome ? g?.awayTeam?.score : g?.homeTeam?.score;

    let result = "T";
    if (teamScore > opponentScore) result = "W";
    if (teamScore < opponentScore) result = "L";

    return {
      gameId: g.id,
      date: g.gameDate,
      opponent,
      homeAway: isHome ? "vs" : "@",
      teamScore,
      opponentScore,
      result,
      boxscoreUrl: `https://www.nhl.com/gamecenter/${g.id}/boxscore`,
    };
  });
}

function normalizeSkaters(rosterData, clubStatsData) {
  const forwards = rosterData?.forwards || [];
  const defensemen = rosterData?.defensemen || [];
  const skaters = [...forwards, ...defensemen];

  const skaterStats =
    clubStatsData?.skaters || clubStatsData?.playerByGameStats || [];

  return skaters.map((player) => {
    const statMatch = skaterStats.find(
      (s) =>
        String(s.playerId) === String(player.id) ||
        String(s.id) === String(player.id)
    );

    return {
      id: player.id,
      name: player?.firstName?.default && player?.lastName?.default
        ? `${player.firstName.default} ${player.lastName.default}`
        : player?.fullName?.default || "",
      position: player?.positionCode || "",
      gamesPlayed: statMatch?.gamesPlayed ?? 0,
      goals: statMatch?.goals ?? 0,
      assists: statMatch?.assists ?? 0,
      points: statMatch?.points ?? 0,
      shots: statMatch?.shots ?? 0,
      plusMinus: statMatch?.plusMinus ?? 0,
      pim: statMatch?.penaltyMinutes ?? 0,
      toi: secondsToToi(statMatch?.avgTimeOnIcePerGame),
    };
  });
}

function secondsToToi(totalSeconds) {
  const safeSeconds = Math.round(Number(totalSeconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatSavePctg(value) {
  if (value == null || Number.isNaN(Number(value))) return ".000";
  return Number(value).toFixed(3).replace(/^0/, "");
}

function formatGAA(value) {
  if (value == null || Number.isNaN(Number(value))) return "0.00";
  return Number(value).toFixed(2);
}

function normalizeGoalies(rosterData, clubStatsData) {
  const goalies = rosterData?.goalies || [];
  const goalieStats =
    clubStatsData?.goalies || clubStatsData?.goalieByGameStats || [];

  return goalies.map((player) => {
    const statMatch = goalieStats.find(
      (s) =>
        String(s.playerId) === String(player.id) ||
        String(s.id) === String(player.id)
    );

    return {
      id: player.id,
      name: player?.firstName?.default && player?.lastName?.default
        ? `${player.firstName.default} ${player.lastName.default}`
        : player?.fullName?.default || "",
      position: player?.positionCode || "G",
      gamesPlayed: statMatch?.gamesPlayed ?? 0,
      gamesStarted: statMatch?.gamesStarted ?? 0,
      wins: statMatch?.wins ?? 0,
      losses: statMatch?.losses ?? 0,
      otLosses: statMatch?.otLosses ?? 0,
      savePercentage: formatSavePctg(statMatch?.savePercentage),
      goalsAgainstAverage: formatGAA(statMatch?.goalsAgainstAverage),
      shutouts: statMatch?.shutouts ?? 0,
    };
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const team = (searchParams.get("team") || "BOS").toUpperCase();
  const season = getCurrentNhlSeason();

  try {
    const rosterUrl = `https://api-web.nhle.com/v1/roster/${team}/current`;
    const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/${team}/${season}`;
    const clubStatsUrl = `https://api-web.nhle.com/v1/club-stats/${team}/${season}/2`;

    const [rosterRes, scheduleRes, clubStatsRes] = await Promise.all([
      fetch(rosterUrl, { next: { revalidate: 3600 } }),
      fetch(scheduleUrl, { next: { revalidate: 900 } }),
      fetch(clubStatsUrl, { next: { revalidate: 3600 } }),
    ]);

    if (!rosterRes.ok || !scheduleRes.ok || !clubStatsRes.ok) {
      return Response.json(
        { error: "Failed to fetch team dashboard data" },
        { status: 502 }
      );
    }

    const [rosterData, scheduleData, clubStatsData] = await Promise.all([
      rosterRes.json(),
      scheduleRes.json(),
      clubStatsRes.json(),
    ]);

    const teamName = getTeamDisplayName(rosterData, team);
    const recentGames = formatRecentGames(scheduleData, team);
    const skaters = normalizeSkaters(rosterData, clubStatsData);
    const goalies = normalizeGoalies(rosterData, clubStatsData);

    return Response.json({
      team,
      teamName,
      season,
      recentGames,
      skaters,
      goalies,
    });
  } catch (error) {
    return Response.json(
      { error: "Unexpected team dashboard error" },
      { status: 500 }
    );
  }
}