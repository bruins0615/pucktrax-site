const MODEL_CONFIG = require("../../config/model-config");

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const {
    atomicWrite
} = require("../collectors/collect-league-reference");

const {
    requireNumber,
    baselineKey,
    indexUnique,
    playerSeasonKey,
    addPercentileRatings
} = require("./calculate-offensive-ratings");

const ZONES = [
    ["defensiveZone", "defensiveZoneFaceoffWinPct"],
    ["offensiveZone", "offensiveZoneFaceoffWinPct"],
    ["neutralZone", "neutralZoneFaceoffWinPct"]
];

function count(value, label) {
    const result = requireNumber(value, label);

    if (!Number.isInteger(result) || result < 0) {
        throw new Error(`Invalid faceoff count: ${label}`);
    }

    return result;
}

function calculateFaceoffSeasonScore(record, baselinesByKey) {
    const identity = `${record.playerId}-${record.season}`;
    const rules = MODEL_CONFIG.faceoffEligibility;
    const weights = MODEL_CONFIG.faceoffZoneWeights;

    const overallDraws = count(
        record.totalFaceoffs,
        `total faceoffs for ${identity}`
    );

    const overallEligible =
        overallDraws >= rules.minimumOverallDraws;

    const zoneDraws = Object.fromEntries(
        ZONES.map(([zone]) => [
            zone,
            count(
                record[`${zone}Faceoffs`],
                `${zone} draws for ${identity}`
            )
        ])
    );

    const eligible =
        overallEligible &&
        ZONES.every(
            ([zone]) => zoneDraws[zone] >= rules.minimumZoneDraws
        );

    const result = {
        season: record.season,
        playerId: record.playerId,
        player: record.player,
        position: record.position,
        gamesPlayed: record.gamesPlayed,
        totalFaceoffs: overallDraws,
        defensiveZoneFaceoffs: zoneDraws.defensiveZone,
        offensiveZoneFaceoffs: zoneDraws.offensiveZone,
        neutralZoneFaceoffs: zoneDraws.neutralZone,
        sampleStatus: overallDraws === 0
            ? "Not applicable"
            : !overallEligible
                ? "Limited sample"
                : eligible
                    ? "Eligible"
                    : "Incomplete zone sample",
        faceoffIndex: null
    };

    for (const [, metric] of ZONES) {
        result[metric] = record[metric];
        result[`${metric}StandardizedValue`] = null;
        result[`${metric}Contribution`] = null;
    }

    // No partial combined score or redistributed weights.
    if (!eligible) {
        return result;
    }

    let index = 0;
    let weightTotal = 0;

    for (const [, metric] of ZONES) {
        const baseline = baselinesByKey.get(
            baselineKey(record.season, "All", metric)
        );

        if (!baseline || baseline.scalingStatus !== "Available") {
            throw new Error(
                `Unavailable faceoff baseline: ${metric}, ${identity}`
            );
        }

        const value = requireNumber(
            record[metric],
            `${metric} for ${identity}`
        );

        const mean = requireNumber(
            baseline.mean,
            `baseline mean for ${metric}`
        );

        const deviation = requireNumber(
            baseline.populationStandardDeviation,
            `baseline deviation for ${metric}`
        );

        const weight = requireNumber(
            weights[metric],
            `weight for ${metric}`
        );

        if (
            value < 0 || value > 1 ||
            mean < 0 || mean > 1 ||
            deviation <= 0 ||
            weight < 0
        ) {
            throw new Error(
                `Invalid faceoff scoring input: ${metric}, ${identity}`
            );
        }

        const standardized = (value - mean) / deviation;
        const contribution = standardized * weight;

        result[`${metric}StandardizedValue`] = standardized;
        result[`${metric}Contribution`] = contribution;

        index += contribution;
        weightTotal += weight;
    }

    if (Math.abs(weightTotal - 1) > 1e-6) {
        throw new Error("Faceoff zone weights must sum to one");
    }

    result.faceoffIndex = index;
    return result;
}

function buildFaceoffHistoricalScores(seasonScores) {
    const window = MODEL_CONFIG.historicalSeasons.map(String);
    const players = new Map();

    for (const record of seasonScores) {
        if (!window.includes(record.season)) continue;

        if (!players.has(record.playerId)) {
            players.set(record.playerId, []);
        }

        players.get(record.playerId).push(record);
    }

    return [...players.values()].map((history) => {
        history.sort((a, b) => a.season.localeCompare(b.season));

        const latest = history[history.length - 1];
        const eligible = history.filter(
            (record) => record.faceoffIndex !== null
        );

        const sum = (rows, field) =>
            rows.reduce(
                (total, record) =>
                    total + requireNumber(record[field], field),
                0
            );

        const average = (field) =>
            eligible.length === 0
                ? null
                : sum(eligible, field) / eligible.length;

        const fields = [
            "faceoffIndex",
            ...ZONES.map(([, metric]) => `${metric}Contribution`)
        ];

        return {
            playerId: latest.playerId,
            player: latest.player,
            position: latest.position,
            windowStart: window[0],
            windowEnd: window[window.length - 1],
            availableSeasons: history.length,
            eligibleSeasons: eligible.length,
            includedSeasons:
                eligible.map((record) => record.season).join(","),
            gamesPlayedInRecordedSeasons: sum(history, "gamesPlayed"),
            faceoffsInRecordedSeasons: sum(history, "totalFaceoffs"),
            gamesPlayedInEligibleSeasons: sum(eligible, "gamesPlayed"),
            faceoffsInEligibleSeasons: sum(eligible, "totalFaceoffs"),
            ...Object.fromEntries(
                fields.map((field) => [field, average(field)])
            ),
            historyStatus: eligible.length > 0
                ? `${eligible.length}-season history`
                : history.every(
                    (record) => record.sampleStatus === "Not applicable"
                )
                    ? "Not applicable"
                    : "No eligible history"
        };
    });
}

function main() {
    const sourceFingerprints = [];

    function readSource(filename) {
        const relativePath = `data/league-reference/${filename}`;
        const contents = fs.readFileSync(path.resolve(relativePath));

        sourceFingerprints.push({
            path: relativePath,
            algorithm: "sha256",
            hash: createHash("sha256").update(contents).digest("hex"),
            bytes: contents.length
        });

        const rows = parse(contents.toString("utf8"), {
            columns: true,
            skip_empty_lines: true
        });

        if (!rows.length) {
            throw new Error(`Empty faceoff source: ${relativePath}`);
        }

        return rows;
    }

    const records = readSource("faceoff-skaters.csv");
    const baselines = readSource("faceoff-baselines.csv");

    indexUnique(records, playerSeasonKey, "faceoff player-season");

    const baselinesByKey = indexUnique(
        baselines,
        (row) => baselineKey(row.season, row.position, row.metric),
        "faceoff baseline"
    );

    const seasons = MODEL_CONFIG.historicalSeasons.map(String);

    for (const record of records) {
        const identity = playerSeasonKey(record);

        if (
            !seasons.includes(record.season) ||
            !["C", "L", "R", "D"].includes(record.position) ||
            !/^\d+$/.test(record.playerId)
        ) {
            throw new Error(`Invalid faceoff identity: ${identity}`);
        }

        const games = requireNumber(
            record.gamesPlayed,
            `games played for ${identity}`
        );

        if (!Number.isInteger(games) || games <= 0) {
            throw new Error(`Invalid games played: ${identity}`);
        }

        const total = count(record.totalFaceoffs, identity);
        const zoneTotal = ZONES.reduce(
            (sum, [zone]) =>
                sum + count(record[`${zone}Faceoffs`], identity),
            0
        );

        if (total !== zoneTotal) {
            throw new Error(`Faceoff zone totals mismatch: ${identity}`);
        }
    }

    const scores = records.map((record) =>
        calculateFaceoffSeasonScore(record, baselinesByKey)
    );

    const seasonRatings = addPercentileRatings(
        scores,
        (record) => record.season,
        "faceoffIndex",
        "faceoffRating"
    );

    const historicalRatings = addPercentileRatings(
        buildFaceoffHistoricalScores(scores),
        () => "All",
        "faceoffIndex",
        "faceoffRating"
    );

    const statusCounts = {};

    for (const record of scores) {
        statusCounts[record.sampleStatus] =
            (statusCounts[record.sampleStatus] ?? 0) + 1;
    }

    const directory = path.resolve("data/faceoff-ratings");
    fs.mkdirSync(directory, { recursive: true });

    function saveRatings(filename, rows) {
        const columns = [
            ...new Set(rows.flatMap((record) => Object.keys(record)))
        ];

        atomicWrite(
            path.join(directory, filename),
            stringify(rows, { header: true, columns })
        );
    }

    saveRatings("season-faceoff-indices.csv", seasonRatings);
    saveRatings(
        "historical-faceoff-ratings.csv",
        historicalRatings
    );

    atomicWrite(
        path.join(directory, "model-metadata.json"),
        JSON.stringify({
            modelVersion: MODEL_CONFIG.faceoffModelVersion,
            generatedAt: new Date().toISOString(),
            historicalSeasons: seasons,
            eligibility: MODEL_CONFIG.faceoffEligibility,
            zoneWeights: MODEL_CONFIG.faceoffZoneWeights,
            formula:
                "Sum of zone weight multiplied by " +
                "(player zone win fraction minus same-season pooled mean) " +
                "divided by pooled population standard deviation.",
            baselineGrouping:
                "All qualifying NHL positions pooled; each player equally weighted. " +
                "Each zone baseline uses its independently eligible pool.",
            combinedEligibility:
                "Overall minimum and all three zone minimums required. " +
                "Incomplete profiles receive no partial score or redistributed weights.",
            contextOnly:
                "Overall, PP, SH and even-strength results receive no extra weight.",
            percentageStorage: "Fractions from 0 to 1.",
            missingDataPolicy:
                "Recorded statistics retained. Nonqualifying indices remain blank, " +
                "distinct from a valid zero. Invalid eligible inputs fail the run.",
            sourceFingerprints,
            historicalAggregation:
                "Equal average of unrounded eligible season indices " +
                "within the configured historical window.",
            gradeComparisonGroups:
                "Season grades pool eligible indices within each season. " +
                "Historical grades pool players with at least one eligible " +
                "season across all NHL positions.",
            percentileMethod:
                "100 * (players below + half the players tied) / group size.",
            ratingMethod:
                "Percentile divided by 10, rounded to one decimal. " +
                "Unrated and not applicable remain distinct from zero.",
            outputCounts: {
                seasonRecords: scores.length,
                eligibleSeasonIndices:
                    scores.filter((row) => row.faceoffIndex !== null).length,
                byStatus: statusCounts,
                historicalRecords: historicalRatings.length,
                ratedHistoricalPlayers: historicalRatings.filter(
                    (row) => row.faceoffRating !== null
                ).length
            },
            note:
                "Provisional descriptive faceoff ratings. " +
                "Shared percentile grading is used across categories. " +
                "A rounded 10.0 does not indicate perfection. " +
                "No overall-value contribution has been assigned."
        }, null, 2) + "\n"
    );

    const examples = new Set([
        "Claude Giroux",
        "Jordan Staal",
        "Anthony Cirelli",
        "Elias Lindholm",
        "Pavel Zacha",
        "Mark Kastelic",
        "Jonathan Toews",
        "Cale Makar"
    ]);

    for (const season of seasons) {
        console.log(`\nFaceoff indices: ${season}`);

        console.table(
            scores
                .filter(
                    (row) =>
                        row.season === season &&
                        examples.has(row.player)
                )
                .map((row) => ({
                    player: row.player,
                    position: row.position,
                    status: row.sampleStatus,
                    defensive:
                        row.defensiveZoneFaceoffWinPctContribution
                            ?.toFixed(3) ?? "—",
                    offensive:
                        row.offensiveZoneFaceoffWinPctContribution
                            ?.toFixed(3) ?? "—",
                    neutral:
                        row.neutralZoneFaceoffWinPctContribution
                            ?.toFixed(3) ?? "—",
                    faceoffIndex: row.faceoffIndex?.toFixed(3) ?? "—"
                }))
        );
    }

    console.log(
        `Saved ${scores.length} records; ` +
        `${statusCounts.Eligible ?? 0} eligible faceoff season indices.`
    );
    console.log(`Output directory: ${directory}`);
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
    calculateFaceoffSeasonScore,
    buildFaceoffHistoricalScores
};