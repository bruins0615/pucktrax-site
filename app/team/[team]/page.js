async function getTeamDashboard(team) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/nhl/team-dashboard?team=${team}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to load team dashboard");
  }

  return res.json();
}

export default async function TeamPage({ params }) {
  const { team } = await params;
  const teamCode = team.toUpperCase();
  const data = await getTeamDashboard(teamCode);

  return (
    <main className="min-h-screen bg-sky-100 px-6 py-10">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-black space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">
            {data.teamName} Dashboard
          </h1>
          <p className="text-slate-600 mt-2">
            {data.team} • {data.season}
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Recent Games
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm text-black">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Matchup</th>
                  <th className="text-left px-4 py-3 font-semibold">Result</th>
                  <th className="text-left px-4 py-3 font-semibold">Score</th>
                  <th className="text-left px-4 py-3 font-semibold">Boxscore</th>
                </tr>
              </thead>
              <tbody>
                {data.recentGames.map((game) => (
                  <tr key={game.gameId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{game.date}</td>
                    <td className="px-4 py-3">
                      {game.homeAway} {game.opponent}
                    </td>
                    <td className="px-4 py-3 font-semibold">{game.result}</td>
                    <td className="px-4 py-3">
                      {data.team} {game.teamScore} - {game.opponentScore} {game.opponent}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={game.boxscoreUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-700 font-semibold hover:underline"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Skaters
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm text-black">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Player</th>
                  <th className="text-left px-4 py-3 font-semibold">Pos</th>
                  <th className="text-left px-4 py-3 font-semibold">GP</th>
                  <th className="text-left px-4 py-3 font-semibold">G</th>
                  <th className="text-left px-4 py-3 font-semibold">A</th>
                  <th className="text-left px-4 py-3 font-semibold">PTS</th>
                  <th className="text-left px-4 py-3 font-semibold">SOG</th>
                  <th className="text-left px-4 py-3 font-semibold">+/-</th>
                  <th className="text-left px-4 py-3 font-semibold">PIM</th>
                  <th className="text-left px-4 py-3 font-semibold">TOI</th>
                </tr>
              </thead>
              <tbody>
                {data.skaters.map((player) => (
                  <tr key={player.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{player.name}</td>
                    <td className="px-4 py-3">{player.position}</td>
                    <td className="px-4 py-3">{player.gamesPlayed}</td>
                    <td className="px-4 py-3">{player.goals}</td>
                    <td className="px-4 py-3">{player.assists}</td>
                    <td className="px-4 py-3 font-semibold">{player.points}</td>
                    <td className="px-4 py-3">{player.shots}</td>
                    <td className="px-4 py-3">{player.plusMinus}</td>
                    <td className="px-4 py-3">{player.pim}</td>
                    <td className="px-4 py-3">{player.toi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Goalies
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm text-black">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Player</th>
                  <th className="text-left px-4 py-3 font-semibold">GP</th>
                  <th className="text-left px-4 py-3 font-semibold">GS</th>
                  <th className="text-left px-4 py-3 font-semibold">W</th>
                  <th className="text-left px-4 py-3 font-semibold">L</th>
                  <th className="text-left px-4 py-3 font-semibold">OTL</th>
                  <th className="text-left px-4 py-3 font-semibold">SV%</th>
                  <th className="text-left px-4 py-3 font-semibold">GAA</th>
                  <th className="text-left px-4 py-3 font-semibold">SO</th>
                </tr>
              </thead>
              <tbody>
                {data.goalies.map((player) => (
                  <tr key={player.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{player.name}</td>
                    <td className="px-4 py-3">{player.gamesPlayed}</td>
                    <td className="px-4 py-3">{player.gamesStarted}</td>
                    <td className="px-4 py-3">{player.wins}</td>
                    <td className="px-4 py-3">{player.losses}</td>
                    <td className="px-4 py-3">{player.otLosses}</td>
                    <td className="px-4 py-3">{player.savePercentage}</td>
                    <td className="px-4 py-3">{player.goalsAgainstAverage}</td>
                    <td className="px-4 py-3">{player.shutouts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}