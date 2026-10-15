// Preview the current NHL roster by default. Collection requires --collect.
const fs = require("fs");
const { collectPlayers } = require("./skater-collector");

function normalizeRoster(roster) {
  if (!Array.isArray(roster.forwards) || !Array.isArray(roster.defensemen)) {
    throw new Error("Roster response is missing forward or defense groups");
  }
  const players = [...roster.forwards, ...roster.defensemen].map((player) => ({
    playerId: player.id,
    name: `${player.firstName?.default ?? ""} ${player.lastName?.default ?? ""}`.trim(),
    positionCode: player.positionCode,
    teamAbbrev: "BOS"
  }));
  if (!players.length || players.some((p) => !Number.isInteger(p.playerId) || !p.name || !["C", "L", "R", "D"].includes(p.positionCode))) {
    throw new Error("Roster is empty or contains invalid skater identities");
  }
  if (new Set(players.map((p) => p.playerId)).size !== players.length) {
    throw new Error("Roster contains duplicate player IDs");
  }
  return players;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--collect", "--season-roster"].includes(arg))) {
    throw new Error("Usage: node scripts/collect-bruins.js [--collect | --season-roster]");
  }
  const seasonPreview = args.includes("--season-roster");
  if (seasonPreview && args.includes("--collect")) {
    throw new Error("Season-roster fallback is preview-only; it is not verified as the active roster");
  }
  const endpoint = seasonPreview ? "20262027" : "current";
  const url = `https://api-web.nhle.com/v1/roster/BOS/${endpoint}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Roster request failed: HTTP ${response.status}`);
  const text = await response.text();
  if (!text.trim()) throw new Error("Current roster returned an empty body. Use --season-roster to preview the 2026-27 roster, but verify active membership before collecting.");
  const players = normalizeRoster(JSON.parse(text));
  console.log(`${seasonPreview ? "2026-27 season roster (not verified active)" : "Current NHL roster"}: ${players.length} Bruins skaters; goalies excluded.`);
  console.table(players);
  if (!args.includes("--collect")) {
    console.log("Preview only. No player statistics or output files changed.");
    return;
  }
  fs.mkdirSync("data", { recursive: true });
  // Separate output prevents collisions with comparison-player backfills.
  await collectPlayers({
    players,
    seasons: [20232024, 20242025, 20252026],
    outputFile: "data/bruins-skater-performance.csv"
  });
}

if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
module.exports = { normalizeRoster };
