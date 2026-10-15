const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const { atomicWrite } = require("./collect-league-reference");

const REFERENCE_DIRECTORY = path.resolve("data/league-reference");

const MODEL_CONFIG = require("../config/model-config");

const HISTORICAL_SEASONS =
    MODEL_CONFIG.historicalSeasons.map(String);

const METRIC_WEIGHTS = MODEL_CONFIG.fiveOnFiveWeights;

const PP_COEFFICIENT = MODEL_CONFIG.powerPlayCoefficient;

function readReference(filename) {
    const text = fs.readFileSync(
        path.join(REFERENCE_DIRECTORY, filename),
        "utf8"
    );

    return parse(text, {
        columns: true,
        skip_empty_lines: true
    });
}

function playerSeasonKey(record) {
    return `${record.playerId}-${record.season}`;
}

function baselineKey(season, position, metric) {
    return `${season}-${position}-${metric}`;
}

function requireNumber(value, label) {
    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        throw new Error(`Missing number: ${label}`);
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        throw new Error(`Invalid number: ${label}`);
    }

    return number;
}

function indexUnique(records, getKey, label) {
    const index = new Map();

    for (const record of records) {
        const key = getKey(record);

        if (index.has(key)) {
            throw new Error(`Duplicate ${label}: ${key}`);
        }

        index.set(key, record);
    }

    return index;
}

function calculateSeasonScore(skater, pp, baselinesByKey) {
    const key = playerSeasonKey(skater);

    const result = {
        season: skater.season,
        playerId: skater.playerId,
        player: skater.player,
        position: skater.position,
        gamesPlayed: skater.gamesPlayed,
        estimatedMinutes5v5: skater.estimatedMinutes5v5,
        sampleStatus: skater.sampleStatus,
        powerPlaySampleStatus: pp.sampleStatus,
        powerPlayPointsPerGame: pp.powerPlayPointsPerGame,
        fiveOnFiveScore: null,
        powerPlayContribution: null,
        offensiveIndex: null
    };

    // Keep limited samples visible without assigning an index.
    if (skater.sampleStatus !== "Eligible") {
        return result;
    }

    let fiveOnFiveScore = 0;

    for (const [metric, weight] of Object.entries(METRIC_WEIGHTS)) {
        const baseline = baselinesByKey.get(
            baselineKey(skater.season, skater.position, metric)
        );

        if (!baseline || baseline.scalingStatus !== "Available") {
            throw new Error(`Unavailable baseline: ${key}, ${metric}`);
        }

        const rate = requireNumber(skater[metric], `${key}: ${metric}`);
        const mean = requireNumber(baseline.mean, `${key}: mean`);
        const sd = requireNumber(
            baseline.populationStandardDeviation,
            `${key}: standard deviation`
        );

        if (rate < 0 || sd <= 0) {
            throw new Error(`Invalid rate or standard deviation: ${key}`);
        }

        const standardizedValue = (rate - mean) / sd;
        const contribution = standardizedValue * weight;

        result[`${metric}Z`] = standardizedValue;
        result[`${metric}Contribution`] = contribution;

        fiveOnFiveScore += contribution;
    }

    const ppPointsPerGame = requireNumber(
        pp.powerPlayPointsPerGame,
        `${key}: PP points/game`
    );

    if (ppPointsPerGame < 0) {
        throw new Error(`Negative PP production: ${key}`);
    }

    result.fiveOnFiveScore = fiveOnFiveScore;
    result.powerPlayContribution = ppPointsPerGame * PP_COEFFICIENT;
    result.offensiveIndex =
        result.fiveOnFiveScore + result.powerPlayContribution;

    return result;
}

function addPercentileRatings(records, getGroupKey, scoreField) {
    const results = records.map((record) => ({
        ...record,
        comparisonGroupSize: null,
        percentile: null,
        offenseRating: null
    }));

    const groups = new Map();

    for (const record of results) {
        if (record[scoreField] === null) continue;

        if (!Number.isFinite(record[scoreField])) {
            throw new Error(`Invalid score for ${record.player}`);
        }

        const key = getGroupKey(record);

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(record);
    }

    for (const group of groups.values()) {
        group.sort((a, b) => a[scoreField] - b[scoreField]);

        let start = 0;

        while (start < group.length) {
            let end = start + 1;

            // Equal scores share the same midpoint percentile.
            while (
                end < group.length &&
                group[end][scoreField] === group[start][scoreField]
            ) {
                end++;
            }

            const percentile =
                ((start + (end - start) / 2) / group.length) * 100;

            for (let index = start; index < end; index++) {
                group[index].comparisonGroupSize = group.length;
                group[index].percentile = percentile;
                group[index].offenseRating =
                    Number((percentile / 10).toFixed(1));
            }

            start = end;
        }
    }

    return results;
}

function buildHistoricalScores(seasonScores) {
    const players = new Map();

    for (const record of seasonScores) {
        if (!HISTORICAL_SEASONS.includes(record.season)) continue;

        if (!players.has(record.playerId)) {
            players.set(record.playerId, []);
        }

        players.get(record.playerId).push(record);
    }

    return [...players.values()].map((history) => {
        history.sort((a, b) => a.season.localeCompare(b.season));

        const latest = history[history.length - 1];

        const eligible = history.filter(
            (record) => record.offensiveIndex !== null
        );

        const average = (field) =>
            eligible.length === 0
                ? null
                : eligible.reduce(
                    (sum, record) => sum + record[field],
                    0
                ) / eligible.length;

        return {
            playerId: latest.playerId,
            player: latest.player,
            position: latest.position,
            windowStart: HISTORICAL_SEASONS[0],
            windowEnd:
                HISTORICAL_SEASONS[HISTORICAL_SEASONS.length - 1],
            availableSeasons: history.length,
            eligibleSeasons: eligible.length,
            includedSeasons: eligible
                .map((record) => record.season)
                .join(","),
            gamesPlayedInRecordedSeasons: history.reduce(
                (sum, record) =>
                    sum + requireNumber(record.gamesPlayed, "games played"),
                0
            ),
            minutes5v5InRecordedSeasons: history.reduce(
                (sum, record) =>
                    sum + requireNumber(
                        record.estimatedMinutes5v5,
                        "five-on-five minutes"
                    ),
                0
            ),
            gamesPlayedInEligibleSeasons: eligible.reduce(
                (sum, record) =>
                    sum + requireNumber(record.gamesPlayed, "games played"),
                0
            ),
            minutes5v5InEligibleSeasons: eligible.reduce(
                (sum, record) =>
                    sum + requireNumber(
                        record.estimatedMinutes5v5,
                        "five-on-five minutes"
                    ),
                0
            ),
            fiveOnFiveScore: average("fiveOnFiveScore"),
            powerPlayContribution: average("powerPlayContribution"),
            offensiveIndex: average("offensiveIndex"),
            historyStatus:
                eligible.length === 0
                    ? "No eligible history"
                    : `${eligible.length}-season history`
        };
    });
}

function main() {
    const skaters = readReference("skaters.csv");
    const baselines = readReference("baselines.csv");
    const powerPlay = readReference("powerplay-skaters.csv");

    console.log(`Loaded ${skaters.length} skater-season records.`);
    console.log(`Loaded ${baselines.length} five-on-five baselines.`);
    console.log(`Loaded ${powerPlay.length} power-play records.`);

    const skatersByKey = indexUnique(
        skaters,
        playerSeasonKey,
        "skater-season"
    );

    const powerPlayByKey = indexUnique(
        powerPlay,
        playerSeasonKey,
        "PP player-season"
    );

    const baselinesByKey = indexUnique(
        baselines,
        (record) =>
            baselineKey(record.season, record.position, record.metric),
        "baseline"
    );

    if (
        skatersByKey.size !== powerPlayByKey.size ||
        [...skatersByKey.keys()].some(
            (key) => !powerPlayByKey.has(key)
        )
    ) {
        throw new Error("Skater and PP player-season coverage differs");
    }

    for (const [key, skater] of skatersByKey) {
        const pp = powerPlayByKey.get(key);

        if (
            skater.position !== pp.position ||
            requireNumber(skater.gamesPlayed, `${key}: games played`) !==
            requireNumber(pp.gamesPlayed, `${key}: PP games played`)
        ) {
            throw new Error(`Position or games mismatch: ${key}`);
        }
    }

    const weightTotal = Object.values(METRIC_WEIGHTS).reduce(
        (sum, weight) => sum + weight,
        0
    );

    if (Math.abs(weightTotal - 1) > 0.000001) {
        throw new Error("Five-on-five weights must add up to 1");
    }

    console.log(
        `Validated ${skatersByKey.size} matching player-seasons ` +
        `and ${baselinesByKey.size} unique baselines.`
    );

    const seasonScores = skaters.map((skater) =>
        calculateSeasonScore(
            skater,
            powerPlayByKey.get(playerSeasonKey(skater)),
            baselinesByKey
        )
    );

    const seasonRatings = addPercentileRatings(
        seasonScores,
        (record) => `${record.season}-${record.position}`,
        "offensiveIndex"
    );

    const scoredCount = seasonScores.filter(
        (record) => record.offensiveIndex !== null
    ).length;

    console.log(
        `Calculated ${scoredCount} eligible season indices.`
    );

    const historicalScores = buildHistoricalScores(seasonScores);

    const historicalRatings = addPercentileRatings(
        historicalScores,
        (record) => record.position,
        "offensiveIndex"
    );

    const examplePlayers = [
        "Cale Makar",
        "Adam Fox",
        "Tage Thompson",
        "Trent Frederic",
        "Seamus Casey"
    ];

    console.log("\nThree-season offensive view:");

    console.table(
        historicalRatings
            .filter((record) => examplePlayers.includes(record.player))
            .map((record) => ({
                player: record.player,
                position: record.position,
                eligibleSeasons: record.eligibleSeasons,
                averageIndex:
                    record.offensiveIndex === null
                        ? "Unavailable"
                        : record.offensiveIndex.toFixed(3),
                percentile:
                    record.percentile === null
                        ? "Unavailable"
                        : record.percentile.toFixed(1),
                offenseRating:
                    record.offenseRating === null
                        ? "Unavailable"
                        : record.offenseRating.toFixed(1)
            }))
    );

    console.table(
        seasonRatings
            .filter(
                (record) =>
                    examplePlayers.includes(record.player) &&
                    record.offensiveIndex !== null
            )
            .map((record) => ({
                player: record.player,
                season: record.season,
                position: record.position,
                index: record.offensiveIndex.toFixed(3),
                comparisonPlayers: record.comparisonGroupSize,
                percentile: record.percentile.toFixed(1),
                offenseRating: record.offenseRating.toFixed(1)
            }))
    );
    const outputDirectory = path.resolve("data/offensive-ratings");

    fs.mkdirSync(outputDirectory, { recursive: true });

    function saveRatings(filename, records) {
        // Include fields from every row, even if the first is unscored.
        const columns = [
            ...new Set(records.flatMap((record) => Object.keys(record)))
        ];

        atomicWrite(
            path.join(outputDirectory, filename),
            stringify(records, {
                header: true,
                columns
            })
        );
    }

    saveRatings("season-offensive-ratings.csv", seasonRatings);

    saveRatings(
        "historical-offensive-ratings.csv",
        historicalRatings
    );

    atomicWrite(
        path.join(outputDirectory, "model-metadata.json"),
        JSON.stringify({
            modelVersion: MODEL_CONFIG.modelVersion,
            generatedAt: new Date().toISOString(),
            historicalSeasons: HISTORICAL_SEASONS,
            fiveOnFiveWeights: METRIC_WEIGHTS,
            powerPlayCoefficient: PP_COEFFICIENT,
            minimumMinutes5v5: MODEL_CONFIG.minimumMinutes5v5,
            minimumPowerPlayMinutesForSampleLabel: MODEL_CONFIG.minimumPowerPlayMinutes,
            powerPlayPolicy:
                "Positive credit for all recorded PP points/game, " +
                "including below the PP sample threshold.",
            seasonComparisonGroup:
                "Same season and NHL position; eligible five-on-five players.",
            historicalComparisonGroup:
                "Same latest recorded NHL position within the historical window; " +
                "players with at least one eligible season.",
            historicalAggregation:
                "Equal average of available eligible season indices, " +
                "followed by historical percentile calculation.",
            percentileMethod:
                "100 * (number below + half the number tied) / group size. " +
                "Uses unrounded indices.",
            ratingMethod:
                "Percentile divided by 10, rounded to one decimal.",
            sampleAdjustment: "None",
            teamContextWeight: 0,
            shorthandedScoringAddition: 0,
            sources: [
                "data/league-reference/skaters.csv",
                "data/league-reference/baselines.csv",
                "data/league-reference/powerplay-skaters.csv"
            ],
            outputCounts: {
                seasonRecords: seasonRatings.length,
                historicalRecords: historicalRatings.length
            },
            note:
                "Descriptive offensive ratings only. Not overall player value " +
                "or projected performance. Zero index is not the combined " +
                "league average; 10.0 can result from percentile rounding."
        }, null, 2) + "\n"
    );

    console.log(`Rating files saved to ${outputDirectory}`);
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = {
    requireNumber,
    indexUnique,
    playerSeasonKey,
    baselineKey,
    calculateSeasonScore,
    addPercentileRatings,
    buildHistoricalScores
};