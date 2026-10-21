const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const { atomicWrite } = require("../collectors/collect-league-reference");
const MODEL_CONFIG = require("../../config/model-config");

const {
    requireNumber,
    baselineKey,
    indexUnique,
    playerSeasonKey
} = require("./calculate-offensive-ratings");

function nonnegativeNumber(value, label) {
    const number = requireNumber(value, label);

    if (number < 0) {
        throw new Error(`Negative number: ${label}`);
    }

    return number;
}

function calculateDefensiveSeasonScore(record, baselinesByKey) {
    const identity = `${record.playerId}-${record.season}`;

    const minutes = nonnegativeNumber(
        record.estimatedMinutes5v5,
        `five-on-five minutes for ${identity}`
    );

    const eligible = minutes >= MODEL_CONFIG.minimumMinutes5v5;

    const result = {
        season: record.season,
        playerId: record.playerId,
        player: record.player,
        position: record.position,
        gamesPlayed: record.gamesPlayed,
        estimatedMinutes5v5: minutes,
        evenStrengthMinutes: record.evenStrengthMinutes,
        allSituationsMinutes: record.allSituationsMinutes,
        sampleStatus: eligible ? "Eligible" : "Limited sample",
        defensiveFoundation: null,
        blockBonus: null,
        takeawayBonus: null,
        defensiveIndex: null
    };

    // Retain exposure without awarding a below-cutoff score.
    if (!eligible) {
        return result;
    }

    let foundation = 0;
    let weightTotal = 0;

    for (const [metric, configuredWeight] of Object.entries(
        MODEL_CONFIG.defensiveSuppressionWeights
    )) {
        const weight = nonnegativeNumber(
            configuredWeight,
            `weight for ${metric}`
        );

        const baseline = baselinesByKey.get(
            baselineKey(record.season, record.position, metric)
        );

        if (!baseline || baseline.scalingStatus !== "Available") {
            throw new Error(
                `Unavailable defensive baseline: ${metric}, ${identity}`
            );
        }

        const rate = nonnegativeNumber(
            record[metric],
            `${metric} for ${identity}`
        );

        const mean = nonnegativeNumber(
            baseline.mean,
            `baseline mean for ${metric}`
        );

        const deviation = requireNumber(
            baseline.populationStandardDeviation,
            `baseline standard deviation for ${metric}`
        );

        if (deviation <= 0) {
            throw new Error(
                `Invalid defensive standard deviation: ${metric}`
            );
        }

        const suppressionValue = (mean - rate) / deviation;
        const contribution = suppressionValue * weight;

        result[`${metric}SuppressionValue`] = suppressionValue;
        result[`${metric}Contribution`] = contribution;

        foundation += contribution;
        weightTotal += weight;
    }

    if (Math.abs(weightTotal - 1) > 0.000001) {
        throw new Error("Defensive suppression weights must sum to 1");
    }

    function actionBonus(metric) {
        const rate = nonnegativeNumber(
            record[metric],
            `${metric} for ${identity}`
        );

        const coefficient = nonnegativeNumber(
            MODEL_CONFIG.defensiveBonusCoefficients[metric],
            `bonus coefficient for ${metric}`
        );

        return rate * coefficient;
    }

    result.defensiveFoundation = foundation;

    result.blockBonus = actionBonus(
        "individualBlockedShotsPer60AllSituations"
    );

    result.takeawayBonus = actionBonus(
        "individualTakeawaysPer60AllSituations"
    );

    result.defensiveIndex =
        foundation + result.blockBonus + result.takeawayBonus;

    return result;
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

        if (rows.length === 0) {
            throw new Error(`Empty reference file: ${relativePath}`);
        }

        return rows;
    }

    const records = readSource("team-context-skaters.csv");
    const baselines = readSource("team-context-baselines.csv");

    indexUnique(records, playerSeasonKey, "player-season");

    const baselinesByKey = indexUnique(
        baselines,
        (row) => baselineKey(row.season, row.position, row.metric),
        "baseline"
    );

    const configuredSeasons = MODEL_CONFIG.historicalSeasons.map(String);

    for (const record of records) {
        if (
            !configuredSeasons.includes(record.season) ||
            !["C", "L", "R", "D"].includes(record.position) ||
            !/^\d+$/.test(record.playerId)
        ) {
            throw new Error(
                `Invalid defensive record identity: ${playerSeasonKey(record)}`
            );
        }
    }

    const scores = records.map((record) =>
        calculateDefensiveSeasonScore(record, baselinesByKey)
    );

    const eligibleCount = scores.filter(
        (record) => record.defensiveIndex !== null
    ).length;

    const directory = path.resolve("data/defensive-ratings");
    fs.mkdirSync(directory, { recursive: true });

    const columns = [
        ...new Set(scores.flatMap((record) => Object.keys(record)))
    ];

    atomicWrite(
        path.join(directory, "season-defensive-indices.csv"),
        stringify(scores, { header: true, columns })
    );

    atomicWrite(
        path.join(directory, "model-metadata.json"),
        JSON.stringify({
            modelVersion: MODEL_CONFIG.defensiveModelVersion,
            generatedAt: new Date().toISOString(),
            historicalSeasons: configuredSeasons,
            minimumMinutes5v5: MODEL_CONFIG.minimumMinutes5v5,
            suppressionWeights: MODEL_CONFIG.defensiveSuppressionWeights,
            bonusCoefficients: MODEL_CONFIG.defensiveBonusCoefficients,
            comparisonGroup:
                "Same season and NHL position; existing five-on-five eligibility group.",
            suppressionDirection:
                "(Positional mean minus player rate) divided by population standard deviation.",
            situations: {
                unblockedAttemptsAgainst: "Five-on-five",
                goalsAgainst: "Even strength",
                blocksAndTakeaways: "All situations"
            },
            bonusPolicy:
                "Proportional positive credit. No positional-average subtraction.",
            missingDataPolicy:
                "Below-cutoff seasons remain unscored. Invalid eligible inputs fail the run.",
            sourceFingerprints,
            outputCounts: {
                seasonRecords: scores.length,
                eligibleSeasonIndices: eligibleCount
            },
            note:
                "Provisional descriptive defensive indices only. " +
                "No historical aggregation, percentile grades, or overall player score. " +
                "On-ice results are unadjusted for teammates, goaltending, opponents and deployment."
        }, null, 2) + "\n"
    );

    const examplePlayers = new Set([
        "Cale Makar",
        "Adam Fox",
        "Victor Hedman",
        "Brock Boeser",
        "Tage Thompson",
        "David Pastrnak",
        "Anthony Cirelli",
        "Anze Kopitar"
    ]);

    function display(value) {
        return value === null ? "Unrated" : value.toFixed(3);
    }

    console.table(
        scores
            .filter(
                (record) =>
                    record.season === String(MODEL_CONFIG.latestCompletedSeason) &&
                    examplePlayers.has(record.player)
            )
            .map((record) => ({
                player: record.player,
                position: record.position,
                foundation: display(record.defensiveFoundation),
                blockBonus: display(record.blockBonus),
                takeawayBonus: display(record.takeawayBonus),
                defensiveIndex: display(record.defensiveIndex)
            }))
    );

    console.log(
        `Saved ${scores.length} records; ` +
        `${eligibleCount} eligible defensive season indices.`
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
    calculateDefensiveSeasonScore
};