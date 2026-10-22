const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const {
    atomicWrite
} = require("../collectors/collect-league-reference");

const MODEL_CONFIG = require("../../config/model-config");

const {
    requireNumber,
    baselineKey,
    indexUnique,
    playerSeasonKey,
    addPercentileRatings,
    buildHistoricalScores
} = require("./calculate-offensive-ratings");

function nonnegativeNumber(value, label) {
    const result = requireNumber(value, label);

    if (result < 0) {
        throw new Error(`Negative number: ${label}`);
    }

    return result;
}

function calculateDisciplineSeasonScore(record, baselinesByKey) {
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
        sampleStatus: eligible ? "Eligible" : "Limited sample",
        penaltyMinutes: record.penaltyMinutes,
        penaltyMinutesPerGame: record.penaltyMinutesPerGame,
        penaltiesTaken: record.penaltiesTaken,
        penaltiesDrawn: record.penaltiesDrawn,
        penaltiesDrawnPerGame: record.penaltiesDrawnPerGame,
        netPenalties: record.netPenalties,
        disciplineFoundation: null,
        penaltiesDrawnStandardizedValue: null,
        penaltiesDrawnBonus: null,
        disciplineIndex: null
    };

    if (!eligible) {
        return result;
    }

    function standardizedValue(metric) {
        const baseline = baselinesByKey.get(
            baselineKey(record.season, record.position, metric)
        );

        if (!baseline || baseline.scalingStatus !== "Available") {
            throw new Error(
                `Unavailable discipline baseline: ${metric}, ${identity}`
            );
        }

        const value = nonnegativeNumber(
            record[metric],
            `${metric} for ${identity}`
        );

        const mean = nonnegativeNumber(
            baseline.mean,
            `baseline mean for ${metric}`
        );

        const deviation = requireNumber(
            baseline.populationStandardDeviation,
            `baseline deviation for ${metric}`
        );

        if (deviation <= 0) {
            throw new Error(
                `Invalid discipline standard deviation: ${metric}`
            );
        }

        return (value - mean) / deviation;
    }

    const foundation = -standardizedValue("penaltyMinutesPerGame");
    const drawingValue = standardizedValue("penaltiesDrawnPerGame");

    const coefficient = nonnegativeNumber(
        MODEL_CONFIG.penaltiesDrawnBonusCoefficient,
        "penalties drawn bonus coefficient"
    );

    const bonus = coefficient * Math.max(0, drawingValue);

    return {
        ...result,
        disciplineFoundation: foundation,
        penaltiesDrawnStandardizedValue: drawingValue,
        penaltiesDrawnBonus: bonus,
        disciplineIndex: foundation + bonus
    };
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
            throw new Error(`Empty source: ${relativePath}`);
        }

        return rows;
    }

    const records = readSource("discipline-skaters.csv");
    const baselines = readSource("discipline-baselines.csv");

    indexUnique(records, playerSeasonKey, "discipline player-season");

    const baselinesByKey = indexUnique(
        baselines,
        (row) => baselineKey(row.season, row.position, row.metric),
        "discipline baseline"
    );

    const seasons = MODEL_CONFIG.historicalSeasons.map(String);

    for (const record of records) {
        if (
            !seasons.includes(record.season) ||
            !["C", "L", "R", "D"].includes(record.position) ||
            !/^\d+$/.test(record.playerId)
        ) {
            throw new Error(
                `Invalid discipline identity: ${playerSeasonKey(record)}`
            );
        }

        const games = requireNumber(
            record.gamesPlayed,
            `games played for ${playerSeasonKey(record)}`
        );

        if (!Number.isInteger(games) || games <= 0) {
            throw new Error(
                `Invalid games played: ${playerSeasonKey(record)}`
            );
        }
    }

    const scores = records.map((record) =>
        calculateDisciplineSeasonScore(record, baselinesByKey)
    );

    const seasonRatings = addPercentileRatings(
        scores,
        (record) => `${record.season}-${record.position}`,
        "disciplineIndex",
        "disciplineRating"
    );

    const historicalScores = buildHistoricalScores(
        scores,
        "disciplineIndex",
        ["disciplineFoundation", "penaltiesDrawnBonus"]
    );

    const historicalRatings = addPercentileRatings(
        historicalScores,
        (record) => record.position,
        "disciplineIndex",
        "disciplineRating"
    );

    const eligibleCount = scores.filter(
        (record) => record.disciplineIndex !== null
    ).length;

    const directory = path.resolve("data/discipline-ratings");
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

    saveRatings("season-discipline-indices.csv", seasonRatings);
    saveRatings(
        "historical-discipline-ratings.csv",
        historicalRatings
    );

    atomicWrite(
        path.join(directory, "model-metadata.json"),
        JSON.stringify({
            modelVersion: MODEL_CONFIG.disciplineModelVersion,
            generatedAt: new Date().toISOString(),
            historicalSeasons: seasons,
            minimumMinutes5v5: MODEL_CONFIG.minimumMinutes5v5,
            penaltiesDrawnBonusCoefficient:
                MODEL_CONFIG.penaltiesDrawnBonusCoefficient,
            foundation:
                "(Positional mean PIM/game minus player PIM/game) " +
                "divided by positional population standard deviation.",
            drawingBonus:
                "Coefficient multiplied by max(0, standardized " +
                "penalties drawn/game). No below-average deduction.",
            comparisonGroup:
                "Same season and NHL position; minimum five-on-five " +
                "eligibility. Each eligible player equally weighted.",
            situations: "All penalty types and situations.",
            denominator: "All recorded games played.",
            netPenalties: "Display context only; no index contribution.",
            missingDataPolicy:
                "Below-cutoff seasons remain unscored. " +
                "Invalid eligible scoring inputs fail the run.",
            sourceFingerprints,
            historicalAggregation:
                "Equal average of unrounded eligible season indices " +
                "within the configured historical window.",
            historicalComparisonGroup:
                "Latest recorded NHL position within the window; " +
                "players with at least one eligible season.",
            percentileMethod:
                "100 * (players below + half the players tied) " +
                "/ comparison group size.",
            ratingMethod:
                "Percentile divided by 10, rounded to one decimal. " +
                "Unrated remains distinct from zero.",
            outputCounts: {
                seasonRecords: scores.length,
                eligibleSeasonIndices: eligibleCount,
                historicalRecords: historicalRatings.length,
                ratedHistoricalPlayers: historicalRatings.filter(
                    (record) => record.disciplineRating !== null
                ).length
            },
            note:
                "Provisional descriptive discipline ratings. " +
                "Grading uses the same shared helpers as offense and defense. " +
                "A rounded 10.0 does not indicate perfection. " +
                "Penalty statistics do not equal power-play opportunities. " +
                "No overall-player contribution has been assigned."
        }, null, 2) + "\n"
    );

    const examplePlayers = new Set([
        "Nikita Zadorov",
        "Mark Kastelic",
        "David Pastrnak",
        "Brad Marchand",
        "Cale Makar",
        "Adam Fox",
        "Jaccob Slavin",
        "Jordan Staal"
    ]);

    console.table(
        scores
            .filter(
                (record) =>
                    record.season ===
                    String(MODEL_CONFIG.latestCompletedSeason) &&
                    examplePlayers.has(record.player)
            )
            .map((record) => ({
                player: record.player,
                position: record.position,
                foundation:
                    record.disciplineFoundation?.toFixed(3) ?? "Unrated",
                drawingBonus:
                    record.penaltiesDrawnBonus?.toFixed(3) ?? "Unrated",
                disciplineIndex:
                    record.disciplineIndex?.toFixed(3) ?? "Unrated"
            }))
    );

    console.log("\nThree-season discipline view:");

    console.table(
        historicalRatings
            .filter((record) => examplePlayers.has(record.player))
            .map((record) => ({
                player: record.player,
                position: record.position,
                eligibleSeasons: record.eligibleSeasons,
                averageIndex:
                    record.disciplineIndex?.toFixed(3) ?? "Unrated",
                percentile:
                    record.percentile?.toFixed(1) ?? "Unrated",
                disciplineRating:
                    record.disciplineRating?.toFixed(1) ?? "Unrated"
            }))
    );

    console.log(
        `Saved ${scores.length} records; ` +
        `${eligibleCount} eligible discipline season indices.`
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
    calculateDisciplineSeasonScore
};