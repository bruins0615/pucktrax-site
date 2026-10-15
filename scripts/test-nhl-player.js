// Contract names select the comparison group; collection logic is shared.
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { collectPlayers } = require("./skater-collector");
const contracts = parse(fs.readFileSync("data/nhlcontracts.csv", "utf8"), {
  columns: true, skip_empty_lines: true
});
const players = [...new Set(contracts.map((row) => row.Player).filter(Boolean))];
console.log(`Loaded ${players.length} unique contract players.`);
collectPlayers({ players }).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
