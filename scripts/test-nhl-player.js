const fs = require("fs");
const { parse } = require("csv-parse/sync");

const csvData = fs.readFileSync("data/nhlcontracts.csv", "utf8");

const contracts = parse(csvData, {
  columns: true,
  skip_empty_lines: true
});

const PLAYER_NAMES = [
  ...new Set(
    contracts
      .map((row) => row.Player)
      .filter(Boolean)
  )
];

console.log(`Loaded ${PLAYER_NAMES.length} unique players from contracts.`);
console.log(PLAYER_NAMES);

async function findPlayer(name) {
  const url =
    `https://search.d3.nhle.com/api/v1/search/player` +
    `?culture=en-us&limit=50&q=${encodeURIComponent(name)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Player search failed: ${response.status}`);
  }

  const players = await response.json();

  return players;
}

async function getPlayerLanding(playerId) {
  const url = `https://api-web.nhle.com/v1/player/${playerId}/landing`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url);

    if (response.ok) {
      return response.json();
    }

    if (response.status === 429) {
      console.log(`Rate limited. Waiting 5 seconds before retry ${attempt}/3...`);
      await sleep(5000);
      continue;
    }

    throw new Error(`Player data failed: ${response.status}`);
  }

  throw new Error(`Player data failed after 3 attempts.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const allRecords = [];

  for (const playerName of PLAYER_NAMES) {
    console.log(`\nSearching NHL for: ${playerName}`);

    const players = await findPlayer(playerName);

    const exactMatches = players.filter(
      (p) => p.name.toLowerCase() === playerName.toLowerCase()
    );

    if (exactMatches.length === 0) {
      console.log(`Could not find exact match for ${playerName}`);
      continue;
    }
    let player;

    if (exactMatches.length === 1) {
      player = exactMatches[0];
    } else {
      const activeMatches = exactMatches.filter(
        (p) => p.active === true
      );

      if (activeMatches.length === 1) {
        player = activeMatches[0];
        console.log(`Multiple matches found. Using active player: ${player.name}`);
      } else {
        console.log(`Could not safely identify ${playerName}:`);
        console.table(exactMatches);
        continue;
      }
    }

    console.log(`Found: ${player.name}`);
    console.log(`NHL Player ID: ${player.playerId}`);
    console.log(`Position: ${player.positionCode}`);
    console.log(`Team: ${player.teamAbbrev}`);

    if (player.positionCode === "G") {
      console.log(`Skipping goalie for now: ${player.name}`);
      await sleep(1000);
      continue;
    }

    let playerData;

    try {
      playerData = await getPlayerLanding(player.playerId);
    } catch (error) {
      console.log(`Skipping ${player.name}: ${error.message}`);
      await sleep(1000);
      continue;
    }
    
    const nhlSeasons = playerData.seasonTotals.filter(
      (season) =>
        season.leagueAbbrev === "NHL" &&
        season.gameTypeId === 2
    );
    const completedNhlSeasons = nhlSeasons.filter(
      (season) => season.season <= 20252026
    );

    const uniqueSeasons = [
      ...new Set(completedNhlSeasons.map((season) => season.season))
    ];

    const lastFiveSeasons = uniqueSeasons.slice(-5);

    const completedSeasons = completedNhlSeasons.filter(
      (season) => lastFiveSeasons.includes(season.season)
    );

    console.log("\nNHL Regular Season Stats:");

    for (const season of completedSeasons) {

      const record = {
        playerId: player.playerId,
        player: player.name,
        position: player.positionCode,
        season: season.season,
        team: season.teamName?.default ?? player.teamAbbrev,
        gamesPlayed: season.gamesPlayed,
        goals: season.goals,
        assists: season.assists,
        points: season.points,
        shots: season.shots,
        avgToi: season.avgToi,
        powerPlayPoints: season.powerPlayPoints,
        plusMinus: season.plusMinus
      };

      allRecords.push(record);
    }
    await sleep(1000);
  }
  console.log("\nPuckTrax Dataset:");
  console.table(allRecords);
}

main().catch(console.error);