const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const { createRunLogger } = require("./run-logger");

const MODEL_CONFIG = require("../../config/model-config");

const REQUEST_TIMEOUT_MS = 30_000;

const REQUIRED_FIELDS = [
  "playerId", "season", "gamesPlayed", "goals", "assists", "points",
  "totalPrimaryAssists", "totalSecondaryAssists",
  "timeOnIcePerGame5v5SummaryShooting", "goals5v5", "assists5v5",
  "primaryAssists5v5", "secondaryAssists5v5", "points5v5",
  "goalsPer605v5", "assistsPer605v5", "primaryAssistsPer605v5",
  "secondaryAssistsPer605v5", "pointsPer605v5", "timeOnIcePerGame5v5ScoringRates"
];
function isCompleteRecord(record) {
  return REQUIRED_FIELDS.every((field) =>
    record[field] !== undefined && record[field] !== null &&
    String(record[field]).trim() !== "" && Number.isFinite(Number(record[field]))
  ) && Number(record.gamesPlayed) > 0 &&
    Number(record.timeOnIcePerGame5v5ScoringRates) > 0 &&
    Number(record.primaryAssists5v5) + Number(record.secondaryAssists5v5) === Number(record.assists5v5) &&
    Number(record.goals5v5) + Number(record.assists5v5) === Number(record.points5v5);
}

async function findPlayer(name, logger) {
  const url =
    `https://search.d3.nhle.com/api/v1/search/player` +
    `?culture=en-us&limit=50&q=${encodeURIComponent(name)}`;

  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Wait 2 seconds before each request
    await sleep(2000);

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (response.status === 429) {
        if (attempt === maxAttempts) {
          throw new Error("HTTP 429: Maximum retries reached");
        }

        const retryAfter = response.headers.get("retry-after");
        const seconds = Number(retryAfter);

        const waitMs =
          retryAfter && Number.isFinite(seconds)
            ? Math.max(0, seconds * 1000)
            : Math.min(15000 * (2 ** (attempt - 1)), 120000);

        logger.log(
          `Player search rate limited. Waiting ${Math.ceil(waitMs / 1000)} seconds.`
        );

        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Player search failed: HTTP ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      logger.log(
        `Player search error (${attempt}/${maxAttempts}): ${error.message}`
      );

      if (attempt === maxAttempts) {
        throw new Error(`Player search failed for ${name}: ${error.message}`);
      }

      await sleep(5000);
    }
  }
}

async function getPlayerLanding(playerId, logger) {
  const url = `https://api-web.nhle.com/v1/player/${playerId}/landing`;

  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Wait 2 seconds before each request
    await sleep(2000);

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (response.status === 429) {
        if (attempt === maxAttempts) {
          throw new Error("HTTP 429: Maximum retries reached");
        }

        const retryAfter = response.headers.get("retry-after");
        const seconds = Number(retryAfter);

        let waitMs = Math.min(15000 * (2 ** (attempt - 1)), 120000);

        if (retryAfter && Number.isFinite(seconds)) {
          waitMs = Math.max(0, seconds * 1000);
        } else if (retryAfter) {
          const retryDate = Date.parse(retryAfter);

          if (!Number.isNaN(retryDate)) {
            waitMs = Math.max(0, retryDate - Date.now());
          }
        }

        logger.log(
          `Player landing rate limited. Waiting ${Math.ceil(waitMs / 1000)} seconds.`
        );

        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Player data failed: HTTP ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      logger.log(
        `Player landing error (${attempt}/${maxAttempts}): ${error.message}`
      );

      if (attempt === maxAttempts) {
        throw new Error(
          `Player data failed for ${playerId}: ${error.message}`
        );
      }

      await sleep(5000);
    }
  }
}

async function getSkaterStats(playerId, seasonId, report = "summary", logger) {
  const url =
    `https://api.nhle.com/stats/rest/en/skater/${report}` +
    "?isAggregate=false" +
    "&isGame=false" +
    `&cayenneExp=playerId=${playerId} and seasonId=${seasonId} and gameTypeId=2` +
    "&limit=20";

  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Wait 2 seconds before every request
    await sleep(2000);

    try {
      const response = await fetch(encodeURI(url), {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");

        let waitMs = Math.min(15000 * (2 ** (attempt - 1)), 120000);

        if (retryAfter) {
          const seconds = Number(retryAfter);

          if (Number.isFinite(seconds)) {
            waitMs = Math.max(0, seconds * 1000);
          } else {
            const retryDate = Date.parse(retryAfter);

            if (!Number.isNaN(retryDate)) {
              waitMs = Math.max(0, retryDate - Date.now());
            }
          }
        }

        logger.log(
          `Rate limited (${report}). Waiting ${Math.ceil(waitMs / 1000)} seconds.`
        );

        if (attempt === maxAttempts) {
          throw new Error("HTTP 429: Maximum retries reached");
        }

        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return data.data?.[0] ?? null;

    } catch (error) {
      logger.log(
        `NHL Stats API error (${report}, attempt ${attempt}/${maxAttempts}): ${error.message}`
      );

      if (attempt === maxAttempts) {
        throw new Error(
          `Failed to retrieve ${report} for player ${playerId}, season ${seasonId}: ${error.message}`
        );
      }

      await sleep(5000);
    }
  }

  throw new Error(
    `Failed to retrieve ${report} for player ${playerId}, season ${seasonId}`
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectPlayers({ players: playerInputs, outputFile = "data/skater-performance.csv", seasons = null }) {

  const logger = createRunLogger("skater-collection");
  const startedAt = Date.now();

  logger.log("Collection started", {
    outputFile,
    requestedPlayers: playerInputs.length,
    requestedSeasons: seasons ?? "Available completed seasons"
  });

  logger.log(`Run log: ${logger.logFile}`);

  function handleInterruption(signal, exitCode) {
    try {
      logger.error("Collection stopped early", {
        reason: signal,
        finishedAt: new Date().toISOString(),
        durationSeconds: Number(
          ((Date.now() - startedAt) / 1000).toFixed(1)
        ),
        outputFile,
        logFile: logger.logFile,
        note: "Previously saved progress remains on disk."
      });
    } finally {
      process.exit(exitCode);
    }
  }

  const onInterrupt = () => handleInterruption("SIGINT", 130);
  const onTerminate = () => handleInterruption("SIGTERM", 143);

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

  try {
    // Load previously collected player-season records
    let allRecords = [];

    if (fs.existsSync(outputFile)) {
      const existingCsv = fs.readFileSync(outputFile, "utf8");

      if (existingCsv.trim()) {
        const { parse } = await import("csv-parse/sync");

        allRecords = parse(existingCsv, {
          columns: true,
          skip_empty_lines: true
        });
      }
    }

    const completedRecords = new Set(
      allRecords.filter(isCompleteRecord).map((record) => `${record.playerId}-${record.season}`)
    );

    let updated = 0;
    let failures = 0;
    let skippedComplete = 0;
    let playerFailures = 0;
    for (const input of playerInputs) {
      const playerName = typeof input === "string" ? input : input.name;
      let player = typeof input === "string" ? null : input;
      if (!player) {
        logger.log(`\nSearching NHL for: ${playerName}`);

        let players;

        try {
          players = await findPlayer(playerName, logger);
        } catch (error) {
          playerFailures++;
          logger.error(`Skipping ${playerName}: ${error.message}`);
          await sleep(1000);
          continue;
        }

        const exactMatches = players.filter(
          (p) => p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (exactMatches.length === 0) {
          playerFailures++;
          logger.error(`Could not find exact match for ${playerName}`);
          continue;
        }


        if (exactMatches.length === 1) {
          player = exactMatches[0];
        } else {
          const activeMatches = exactMatches.filter(
            (p) => p.active === true
          );

          if (activeMatches.length === 1) {
            player = activeMatches[0];
            logger.log(`Multiple matches found. Using active player: ${player.name}`);
          } else {
            playerFailures++;
            logger.error(`Could not safely identify ${playerName}:`);
            logger.log(exactMatches);
            continue;
          }
        }

      }

      logger.log(`Found: ${player.name}`);
      logger.log(`NHL Player ID: ${player.playerId}`);
      logger.log(`Position: ${player.positionCode}`);
      logger.log(`Team: ${player.teamAbbrev}`);

      if (player.positionCode === "G") {
        logger.log(`Skipping goalie for now: ${player.name}`);
        await sleep(1000);
        continue;
      }

      let playerData;

      try {
        playerData = await getPlayerLanding(player.playerId, logger);
      } catch (error) {
        playerFailures++;
        logger.error(`Skipping ${player.name}: ${error.message}`);
        await sleep(1000);
        continue;
      }

      const nhlSeasons = playerData.seasonTotals.filter(
        (season) =>
          season.leagueAbbrev === "NHL" &&
          season.gameTypeId === 2
      );
      const completedNhlSeasons = nhlSeasons.filter(
        (season) =>
          season.season <= MODEL_CONFIG.latestCompletedSeason
      );

      const uniqueSeasons = [
        ...new Set(completedNhlSeasons.map((season) => season.season))
      ];

      const lastFiveSeasons = seasons
        ? [...new Set(seasons)].filter((season) => uniqueSeasons.includes(season)).sort()
        : uniqueSeasons.sort((a, b) => a - b).slice(-5);

      logger.log("\nNHL Regular Season Stats:");

      for (const seasonId of lastFiveSeasons) {

        const recordKey = `${player.playerId}-${seasonId}`;

        if (completedRecords.has(recordKey)) {
          skippedComplete++;
          logger.log(`Already collected: ${player.name} (${seasonId})`);
          continue;
        }

        try {

          const summaryStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "summary",
            logger
          );

          const realtimeStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "realtime",
            logger
          );

          const timeOnIceStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "timeonice",
            logger
          );

          const faceoffStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "faceoffwins",
            logger
          );

          const penaltyStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "penalties",
            logger
          );

          const goalsForAgainstStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "goalsForAgainst",
            logger
          );

          const puckPossessionStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "puckPossessions",
            logger
          );

          const summaryShootingStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "summaryshooting",
            logger
          );

          const scoringPerGameStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "scoringpergame",
            logger
          );

          const scoringRatesStats = await getSkaterStats(
            player.playerId,
            seasonId,
            "scoringRates",
            logger
          );

          logger.log(
            `NHL Summary: ${player.name} (${seasonId})`,
            summaryStats
          );

          logger.log(
            `NHL Realtime: ${player.name} (${seasonId})`,
            realtimeStats
          );

          logger.log(
            `NHL Time on Ice: ${player.name} (${seasonId})`,
            timeOnIceStats
          );

          logger.log(
            `NHL Faceoffs: ${player.name} (${seasonId})`,
            faceoffStats
          );

          logger.log(
            `NHL Penalties: ${player.name} (${seasonId})`,
            penaltyStats
          );

          logger.log(
            `NHL Goals For/Against: ${player.name} (${seasonId})`,
            goalsForAgainstStats
          );

          logger.log(
            `NHL Puck Possession: ${player.name} (${seasonId})`,
            puckPossessionStats
          );

          logger.log(
            `NHL Summary Shooting: ${player.name} (${seasonId})`,
            summaryShootingStats
          );

          logger.log(
            `NHL Scoring Per Game: ${player.name} (${seasonId})`,
            scoringPerGameStats
          );

          logger.log(
            `NHL Five-on-Five Scoring: ${player.name} (${seasonId})`,
            scoringRatesStats
          );

          const seasonRecords = completedNhlSeasons.filter(
            (season) => season.season === seasonId
          );

          const teams = [
            ...new Set(
              seasonRecords.map(
                (season) => season.teamName?.default ?? player.teamAbbrev
              )
            )
          ];

          const record = {
            //NHL Summary Stats
            playerId: player.playerId,
            player: player.name,
            position: player.positionCode,
            season: seasonId,
            teams: teams.join(","),
            gamesPlayed: summaryStats?.gamesPlayed ?? null,
            goals: summaryStats?.goals ?? null,
            assists: summaryStats?.assists ?? null,
            totalPrimaryAssists: scoringPerGameStats?.totalPrimaryAssists ?? null,
            totalSecondaryAssists: scoringPerGameStats?.totalSecondaryAssists ?? null,
            points: summaryStats?.points ?? null,
            shots: summaryStats?.shots ?? null,
            avgToi: summaryStats?.timeOnIcePerGame ?? null,
            powerPlayPoints: summaryStats?.ppPoints ?? null,
            plusMinus: summaryStats?.plusMinus ?? null,
            evenStrengthGoals: summaryStats?.evGoals ?? null,
            evenStrengthPoints: summaryStats?.evPoints ?? null,
            shootingPct: summaryStats?.shootingPct ?? null,
            faceoffWinPct: summaryStats?.faceoffWinPct ?? null,
            // NHL Five-on-Five Scoring Stats
            goals5v5: scoringRatesStats?.goals5v5 ?? null,
            assists5v5: scoringRatesStats?.assists5v5 ?? null,
            primaryAssists5v5: scoringRatesStats?.primaryAssists5v5 ?? null,
            secondaryAssists5v5: scoringRatesStats?.secondaryAssists5v5 ?? null,
            points5v5: scoringRatesStats?.points5v5 ?? null,
            goalsPer605v5: scoringRatesStats?.goalsPer605v5 ?? null,
            assistsPer605v5: scoringRatesStats?.assistsPer605v5 ?? null,
            primaryAssistsPer605v5: scoringRatesStats?.primaryAssistsPer605v5 ?? null,
            secondaryAssistsPer605v5: scoringRatesStats?.secondaryAssistsPer605v5 ?? null,
            pointsPer605v5: scoringRatesStats?.pointsPer605v5 ?? null,
            timeOnIcePerGame5v5ScoringRates: scoringRatesStats?.timeOnIcePerGame5v5 ?? null,
            //NHL Realtime Stats
            totalShotAttempts: realtimeStats?.totalShotAttempts ?? null,
            missedShots: realtimeStats?.missedShots ?? null,
            shotAttemptsBlocked: realtimeStats?.shotAttemptsBlocked ?? null,
            blockedShots: realtimeStats?.blockedShots ?? null,
            giveaways: realtimeStats?.giveaways ?? null,
            takeaways: realtimeStats?.takeaways ?? null,
            hits: realtimeStats?.hits ?? null,
            //NHL Time on Ice Stats
            timeOnIce: timeOnIceStats?.timeOnIce ?? null,
            evTimeOnIce: timeOnIceStats?.evTimeOnIce ?? null,
            ppTimeOnIce: timeOnIceStats?.ppTimeOnIce ?? null,
            shTimeOnIce: timeOnIceStats?.shTimeOnIce ?? null,
            otTimeOnIce: timeOnIceStats?.otTimeOnIce ?? null,
            shifts: timeOnIceStats?.shifts ?? null,
            shiftsPerGame: timeOnIceStats?.shiftsPerGame ?? null,
            timeOnIcePerShift: timeOnIceStats?.timeOnIcePerShift ?? null,
            // NHL Faceoff Stats
            totalFaceoffs: faceoffStats?.totalFaceoffs ?? null,
            totalFaceoffWins: faceoffStats?.totalFaceoffWins ?? null,
            totalFaceoffLosses: faceoffStats?.totalFaceoffLosses ?? null,
            defensiveZoneFaceoffs: faceoffStats?.defensiveZoneFaceoffs ?? null,
            defensiveZoneFaceoffWins: faceoffStats?.defensiveZoneFaceoffWins ?? null,
            defensiveZoneFaceoffLosses: faceoffStats?.defensiveZoneFaceoffLosses ?? null,
            offensiveZoneFaceoffs: faceoffStats?.offensiveZoneFaceoffs ?? null,
            offensiveZoneFaceoffWins: faceoffStats?.offensiveZoneFaceoffWins ?? null,
            offensiveZoneFaceoffLosses: faceoffStats?.offensiveZoneFaceoffLosses ?? null,
            neutralZoneFaceoffs: faceoffStats?.neutralZoneFaceoffs ?? null,
            neutralZoneFaceoffWins: faceoffStats?.neutralZoneFaceoffWins ?? null,
            neutralZoneFaceoffLosses: faceoffStats?.neutralZoneFaceoffLosses ?? null,
            evFaceoffs: faceoffStats?.evFaceoffs ?? null,
            evFaceoffsWon: faceoffStats?.evFaceoffsWon ?? null,
            evFaceoffsLost: faceoffStats?.evFaceoffsLost ?? null,
            ppFaceoffs: faceoffStats?.ppFaceoffs ?? null,
            ppFaceoffsWon: faceoffStats?.ppFaceoffsWon ?? null,
            ppFaceoffsLost: faceoffStats?.ppFaceoffsLost ?? null,
            shFaceoffs: faceoffStats?.shFaceoffs ?? null,
            shFaceoffsWon: faceoffStats?.shFaceoffsWon ?? null,
            shFaceoffsLost: faceoffStats?.shFaceoffsLost ?? null,
            // NHL Penalty Stats
            penalties: penaltyStats?.penalties ?? null,
            minorPenalties: penaltyStats?.minorPenalties ?? null,
            majorPenalties: penaltyStats?.majorPenalties ?? null,
            penaltiesDrawn: penaltyStats?.penaltiesDrawn ?? null,
            netPenalties: penaltyStats?.netPenalties ?? null,
            penaltyMinutes: penaltyStats?.penaltyMinutes ?? null,
            penaltiesDrawnPer60: penaltyStats?.penaltiesDrawnPer60 ?? null,
            penaltiesTakenPer60: penaltyStats?.penaltiesTakenPer60 ?? null,
            netPenaltiesPer60: penaltyStats?.netPenaltiesPer60 ?? null,
            // NHL Goals For/Against Stats
            evenStrengthGoalsFor: goalsForAgainstStats?.evenStrengthGoalsFor ?? null,
            evenStrengthGoalsAgainst: goalsForAgainstStats?.evenStrengthGoalsAgainst ?? null,
            evenStrengthGoalDifference: goalsForAgainstStats?.evenStrengthGoalDifference ?? null,
            evenStrengthGoalsForPct: goalsForAgainstStats?.evenStrengthGoalsForPct ?? null,
            evenStrengthTimeOnIcePerGame: goalsForAgainstStats?.evenStrengthTimeOnIcePerGame ?? null,
            powerPlayGoalFor: goalsForAgainstStats?.powerPlayGoalFor ?? null,
            powerPlayGoalsAgainst: goalsForAgainstStats?.powerPlayGoalsAgainst ?? null,
            powerPlayTimeOnIcePerGame: goalsForAgainstStats?.powerPlayTimeOnIcePerGame ?? null,
            shortHandedGoalsFor: goalsForAgainstStats?.shortHandedGoalsFor ?? null,
            shortHandedGoalsAgainst: goalsForAgainstStats?.shortHandedGoalsAgainst ?? null,
            shortHandedTimeOnIcePerGame: goalsForAgainstStats?.shortHandedTimeOnIcePerGame ?? null,
            // NHL Puck Possession Stats
            satPct: puckPossessionStats?.satPct ?? null,
            usatPct: puckPossessionStats?.usatPct ?? null,
            goalsPct: puckPossessionStats?.goalsPct ?? null,
            onIceShootingPct: puckPossessionStats?.onIceShootingPct ?? null,
            individualSatForPer60: puckPossessionStats?.individualSatForPer60 ?? null,
            individualShotsForPer60: puckPossessionStats?.individualShotsForPer60 ?? null,
            defensiveZoneStartPct: puckPossessionStats?.defensiveZoneStartPct ?? null,
            offensiveZoneStartPct: puckPossessionStats?.offensiveZoneStartPct ?? null,
            neutralZoneStartPct: puckPossessionStats?.neutralZoneStartPct ?? null,
            offensiveZoneStartRatio: puckPossessionStats?.offensiveZoneStartRatio ?? null,
            faceoffPct5v5: puckPossessionStats?.faceoffPct5v5 ?? null,
            timeOnIcePerGame5v5: puckPossessionStats?.timeOnIcePerGame5v5 ?? null,
            // NHL Summary Shooting Stats
            satFor: summaryShootingStats?.satFor ?? null,
            satAgainst: summaryShootingStats?.satAgainst ?? null,
            satTotal: summaryShootingStats?.satTotal ?? null,
            satRelative: summaryShootingStats?.satRelative ?? null,
            satAhead: summaryShootingStats?.satAhead ?? null,
            satBehind: summaryShootingStats?.satBehind ?? null,
            satTied: summaryShootingStats?.satTied ?? null,
            satClose: summaryShootingStats?.satClose ?? null,
            usatFor: summaryShootingStats?.usatFor ?? null,
            usatAgainst: summaryShootingStats?.usatAgainst ?? null,
            usatTotal: summaryShootingStats?.usatTotal ?? null,
            usatRelative: summaryShootingStats?.usatRelative ?? null,
            usatAhead: summaryShootingStats?.usatAhead ?? null,
            usatBehind: summaryShootingStats?.usatBehind ?? null,
            usatTied: summaryShootingStats?.usatTied ?? null,
            usatClose: summaryShootingStats?.usatClose ?? null,
            timeOnIcePerGame5v5SummaryShooting: summaryShootingStats?.timeOnIcePerGame5v5 ?? null
          };

          if (!isCompleteRecord(record)) {
            throw new Error("Required core statistics missing; existing row preserved");
          }

          const existingIndex = allRecords.findIndex(
            (saved) =>
              `${saved.playerId}-${saved.season}` === recordKey
          );

          if (existingIndex >= 0) {
            allRecords[existingIndex] = record;
          } else {
            allRecords.push(record);
          }


          // Save progress after each completed player-season
          const columns = [
            ...new Set(allRecords.flatMap((saved) => Object.keys(saved)))
          ];

          const csvOutput = stringify(allRecords, {
            header: true,
            columns
          });

          const temporaryFile = `${outputFile}.tmp`;
          fs.writeFileSync(temporaryFile, csvOutput);
          fs.renameSync(temporaryFile, outputFile);
          completedRecords.add(recordKey);
          updated++;

        } catch (error) {
          failures++;
          logger.error(
            `Skipping ${player.name} (${seasonId}): ${error.message}`
          );
        }
      }

      await sleep(1000);
    }
    const hasFailures = failures > 0 || playerFailures > 0;

    const summary = {
      status: hasFailures ? "Completed with failures" : "Completed",
      finishedAt: new Date().toISOString(),
      durationSeconds: Number(
        ((Date.now() - startedAt) / 1000).toFixed(1)
      ),
      playerSeasonsSaved: updated,
      playerSeasonsAlreadyComplete: skippedComplete,
      failedPlayerSeasons: failures,
      failedPlayers: playerFailures,
      totalRecordsInDataset: allRecords.length,
      outputFile,
      logFile: logger.logFile
    };

    if (hasFailures) {
      logger.error("Collection summary", summary);
      process.exitCode = 1;
    } else {
      logger.log("Collection summary", summary);
    }

    return summary;
  } catch (error) {
    logger.error("Collection stopped early", {
      finishedAt: new Date().toISOString(),
      durationSeconds: Number(
        ((Date.now() - startedAt) / 1000).toFixed(1)
      ),
      outputFile,
      error: error.stack ?? String(error)
    });

    process.exitCode = 1;
    throw error;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  }
}

module.exports = { collectPlayers, isCompleteRecord, REQUIRED_FIELDS };  