// League baselines are separate from the detailed player collection.
const fs = require('node:fs');
const path = require('node:path');
const { stringify } = require('csv-stringify/sync');
const MODEL_CONFIG = require("../config/model-config");
const SEASONS = MODEL_CONFIG.historicalSeasons;
const METRICS = ['goalsPer605v5', 'primaryAssistsPer605v5', 'secondaryAssistsPer605v5', 'individualShotsForPer60'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchReport(report, season) {
  const url = new URL(`https://api.nhle.com/stats/rest/en/skater/${report}`);
  url.search = new URLSearchParams({
    isAggregate: 'false', isGame: 'false', limit: '-1',
    cayenneExp: `seasonId=${season} and gameTypeId=2`
  });
  for (let attempt = 1; attempt <= 5; attempt++) {
    await sleep(2000);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) {
        if (response.status === 429 && attempt < 5) {
          const retry = response.headers.get('retry-after');
          const seconds = retry && Number(retry);
          const date = retry && Date.parse(retry);
          const delay = retry && Number.isFinite(seconds) ? Math.max(0, seconds * 1000)
            : retry && Number.isFinite(date) ? Math.max(0, date - Date.now())
              : Math.min(15000 * 2 ** (attempt - 1), 60000);
          console.log(`Rate limited: ${report}, ${season}. Waiting ${Math.ceil(delay / 1000)} seconds.`);
          await sleep(delay);
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.json();
      if (!Array.isArray(body.data) || !body.data.length || body.total !== body.data.length) {
        throw new Error(`Incomplete report: received ${body.data?.length}, expected ${body.total}`);
      }
      return body.data;
    } catch (error) {
      if (attempt === 5) throw new Error(`${report}, ${season}: ${error.message}`);
      console.log(`${report}, ${season}, attempt ${attempt}: ${error.message}`);
      await sleep(5000);
    }
  }
}

function indexReport(rows, season) {
  const result = new Map();
  for (const row of rows) {
    if (!Number.isInteger(row.playerId) || row.seasonId !== season || result.has(row.playerId)) {
      throw new Error(`Invalid identity or duplicate player in season ${season}`);
    }
    result.set(row.playerId, row);
  }
  return result;
}

function buildReference(scoring, possession, season) {
  const a = indexReport(scoring, season);
  const b = indexReport(possession, season);
  if (a.size !== b.size || [...a.keys()].some((id) => !b.has(id))) {
    throw new Error(`Player coverage differs between reports for ${season}`);
  }
  return [...a.values()].map((s) => {
    const p = b.get(s.playerId);
    if (!['C', 'L', 'R', 'D'].includes(s.positionCode) || s.positionCode !== p.positionCode ||
      !Number.isInteger(s.gamesPlayed) || s.gamesPlayed <= 0 || s.gamesPlayed !== p.gamesPlayed) {
      throw new Error(`Position or games mismatch for ${s.playerId}, ${season}`);
    }
    if (!Number.isFinite(s.timeOnIcePerGame5v5) || s.timeOnIcePerGame5v5 < 0) {
      throw new Error(`Invalid ice time for ${s.playerId}, ${season}`);
    }
    const minutes = s.timeOnIcePerGame5v5 * s.gamesPlayed / 60;
    const numeric = ['goals5v5', 'assists5v5', 'primaryAssists5v5', 'secondaryAssists5v5', 'points5v5', ...METRICS.slice(0, 3)];
    const missing = numeric.filter((key) => s[key] == null);
    if (p.individualShotsForPer60 == null) missing.push('individualShotsForPer60');
    if (numeric.some((key) => s[key] != null && (!Number.isFinite(s[key]) || s[key] < 0)) ||
      (p.individualShotsForPer60 != null && (!Number.isFinite(p.individualShotsForPer60) || p.individualShotsForPer60 < 0))) {
      throw new Error(`Invalid numeric fields for ${s.playerId}, ${season}`);
    }
    if (minutes >= MODEL_CONFIG.minimumMinutes5v5 && missing.length) {
      throw new Error(`Eligible player has missing fields: ${s.playerId}, ${season}: ${missing.join(', ')}`);
    }
    if ((['primaryAssists5v5', 'secondaryAssists5v5', 'assists5v5'].every((k) => s[k] != null) &&
      s.primaryAssists5v5 + s.secondaryAssists5v5 !== s.assists5v5) ||
      (['goals5v5', 'assists5v5', 'points5v5'].every((k) => s[k] != null) &&
        s.goals5v5 + s.assists5v5 !== s.points5v5)) {
      throw new Error(`Scoring totals do not reconcile for ${s.playerId}, ${season}`);
    }
    return {
      season, playerId: s.playerId, player: s.skaterFullName, position: s.positionCode,
      gamesPlayed: s.gamesPlayed, estimatedMinutes5v5: minutes,
      sampleStatus: minutes >= MODEL_CONFIG.minimumMinutes5v5 ? 'Eligible' : 'Limited sample',
      dataStatus: missing.length ? `Unavailable fields: ${missing.join(', ')}` : 'Complete',
      goals5v5: s.goals5v5, primaryAssists5v5: s.primaryAssists5v5,
      secondaryAssists5v5: s.secondaryAssists5v5,
      goalsPer605v5: s.goalsPer605v5, primaryAssistsPer605v5: s.primaryAssistsPer605v5,
      secondaryAssistsPer605v5: s.secondaryAssistsPer605v5,
      individualShotsForPer60: p.individualShotsForPer60
    };
  });
}

function calculateBaselines(rows, metrics = METRICS) {
  const groups = new Map();
  for (const row of rows.filter((r) => r.sampleStatus === 'Eligible')) {
    const key = `${row.season}-${row.position}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].flatMap((group) => metrics.map((metric) => {
    const values = group.map((row) => {
      const value = row[metric];

      if (!Number.isFinite(value)) {
        throw new Error(
          `Invalid baseline input: ${metric} for player ` +
          `${row.playerId}, season ${row.season}, ` +
          `position ${row.position}. Expected a finite number.`
        );
      }

      return value;
    });
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
    return {
      season: group[0].season, position: group[0].position, metric,
      eligiblePlayers: values.length, mean, populationStandardDeviation: sd,
      scalingStatus: sd > 0 && values.length > 1 ? 'Available' : 'Unavailable'
    };
  }));
}

function atomicWrite(file, text) {
  fs.writeFileSync(`${file}.tmp`, text);
  fs.renameSync(`${file}.tmp`, file);
}

async function main() {
  const rows = [];
  const sources = [];
  for (const season of SEASONS) {
    const scoring = await fetchReport('scoringRates', season);
    const possession = await fetchReport('puckPossessions', season);
    const reference = buildReference(scoring, possession, season);
    rows.push(...reference);
    sources.push({ season, scoringRows: scoring.length, possessionRows: possession.length });
    console.log(`${season}: ${reference.length} skaters matched; ${reference.filter((r) => r.sampleStatus === 'Eligible').length} eligible.`);
  }
  rows.sort((a, b) => a.season - b.season || a.position.localeCompare(b.position) || a.playerId - b.playerId);
  const baselines = calculateBaselines(rows);
  const directory = path.resolve('data/league-reference');
  fs.mkdirSync(directory, { recursive: true });
  atomicWrite(path.join(directory, 'skaters.csv'), stringify(rows, { header: true }));
  atomicWrite(path.join(directory, 'baselines.csv'), stringify(baselines, { header: true }));
  atomicWrite(path.join(directory, 'metadata.json'), JSON.stringify({
    collectedAt: new Date().toISOString(), seasons: SEASONS, gameTypeId: 2,
    minimumMinutes5v5: MODEL_CONFIG.minimumMinutes5v5, timeSource: 'scoringRates.timeOnIcePerGame5v5 * gamesPlayed; approximate',
    standardDeviation: 'Population; eligible skaters equally weighted within season and NHL position',
    reports: ['scoringRates', 'puckPossessions'], sources,
    note: 'Descriptive reference statistics only. No player scores, rankings, or model weights.'
  }, null, 2) + '\n');
  console.table(baselines.filter((r) => r.metric === METRICS[0]).map(({ season, position, eligiblePlayers }) => ({ season, position, eligiblePlayers })));
  console.log(`Saved ${rows.length} skater-seasons and ${baselines.length} metric baselines to ${directory}`);
}

if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = {
  buildReference,
  calculateBaselines,
  METRICS,
  fetchReport,
  indexReport,
  atomicWrite
};
