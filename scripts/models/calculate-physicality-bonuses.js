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
    playerSeasonKey
} = require("./calculate-offensive-ratings");

function nonnegativeNumber(value, label) {
    const result = requireNumber(value, label);

    if (result < 0) {
        throw new Error(`Negative number: ${label}`);
    }

    return result;
}

function calculatePhysicalitySeasonBonus(record, baselinesByKey) {
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
        allSituationsMinutes: record.allSituationsMinutes,
        hits: record.hits,
        hitsPerGame: record.hitsPerGame,
        hitsPer60AllSituations: record.hitsPer60AllSituations,
        sampleStatus: eligible ? "Eligible" : "Limited sample",
        standardizedHitsPerGame: null,
        uncappedPhysicalityBonus: null,
        physicalityBonus: null,
        capApplied: null
    };

    if (!eligible) {
        return result;
    }

    const baseline = baselinesByKey.get(
        baselineKey(record.season, record.position, "hitsPerGame")
    );

    if (!baseline || baseline.scalingStatus !== "Available") {
        throw new Error(`Unavailable physicality baseline: ${identity}`);
    }

    const value = nonnegativeNumber(
        record.hitsPerGame,
        `hits/game for ${identity}`
    );

    const mean = nonnegativeNumber(
        baseline.mean,
        `hits/game baseline mean for ${identity}`
    );

    const deviation = requireNumber(
        baseline.populationStandardDeviation,
        `hits/game baseline deviation for ${identity}`
    );

    if (deviation <= 0) {
        throw new Error(
            `Invalid physicality standard deviation: ${identity}`
        );
    }

    const coefficient = nonnegativeNumber(
        MODEL_CONFIG.physicalityBonusCoefficient,
        "physicality coefficient"
    );

    const cap = nonnegativeNumber(
        MODEL_CONFIG.physicalityBonusCap,
        "physicality cap"
    );

    const standardized = (value - mean) / deviation;
    const uncapped = coefficient * Math.max(0, standardized);

    return {
        ...result,
        standardizedHitsPerGame: standardized,
        uncappedPhysicalityBonus: uncapped,
        physicalityBonus: Math.min(cap, uncapped),
        capApplied: uncapped > cap
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
            throw new Error(`Empty physicality source: ${relativePath}`);
        }

        return rows;
    }

    const records = readSource("physicality-skaters.csv");
    const baselines = readSource("physicality-baselines.csv");

    indexUnique(records, playerSeasonKey, "physicality player-season");

    const baselinesByKey = indexUnique(
        baselines,
        (row) => baselineKey(row.season, row.position, row.metric),
        "physicality baseline"
    );

    const seasons = MODEL_CONFIG.historicalSeasons.map(String);

    for (const record of records) {
        const identity = playerSeasonKey(record);

        if (
            !seasons.includes(record.season) ||
            !["C", "L", "R", "D"].includes(record.position) ||
            !/^\d+$/.test(record.playerId)
        ) {
            throw new Error(`Invalid physicality identity: ${identity}`);
        }

        const games = requireNumber(
            record.gamesPlayed,
            `games played for ${identity}`
        );

        if (!Number.isInteger(games) || games <= 0) {
            throw new Error(`Invalid games played: ${identity}`);
        }
    }

    const bonuses = records.map((record) =>
        calculatePhysicalitySeasonBonus(record, baselinesByKey)
    );

    const eligible = bonuses.filter(
        (record) => record.physicalityBonus !== null
    );

    const capped = eligible.filter((record) => record.capApplied);
    const directory = path.resolve("data/physicality-bonuses");

    fs.mkdirSync(directory, { recursive: true });

    const columns = [
        ...new Set(bonuses.flatMap((record) => Object.keys(record)))
    ];

    atomicWrite(
        path.join(directory, "season-physicality-bonuses.csv"),
        stringify(bonuses, {
            header: true,
            columns,
            cast: {
                boolean: (value) => String(value)
            }
        })
    );

    atomicWrite(
        path.join(directory, "model-metadata.json"),
        JSON.stringify({
            modelVersion: MODEL_CONFIG.physicalityModelVersion,
            generatedAt: new Date().toISOString(),
            historicalSeasons: seasons,
            minimumMinutes5v5: MODEL_CONFIG.minimumMinutes5v5,
            coefficient: MODEL_CONFIG.physicalityBonusCoefficient,
            cap: MODEL_CONFIG.physicalityBonusCap,
            formula:
                "min(cap, coefficient * max(0, " +
                "(player hits/game minus positional mean) " +
                "/ positional population standard deviation))",
            baselineGrouping: "Same season and NHL position",
            situations: "All-situations hits",
            scoringDenominator: "All recorded games played",
            contextOnly: "Hits per 60 all-situations minutes",
            capAppliedPolicy:
                "True only when the uncapped bonus exceeds the cap.",
            missingDataPolicy:
                "Below-cutoff bonuses remain unavailable. Eligible " +
                "average/below-average hitting earns zero. Invalid " +
                "eligible scoring inputs fail the run.",
            sourceFingerprints,
            outputCounts: {
                seasonRecords: bonuses.length,
                eligibleSeasonBonuses: eligible.length,
                positiveSeasonBonuses: eligible.filter(
                    (record) => record.physicalityBonus > 0
                ).length,
                capAppliedRecords: capped.length
            },
            note:
                "Provisional auxiliary bonus amounts, not direct " +
                "additions to a 0–10 grade. No overall contribution, " +
                "historical aggregation or standalone grade assigned."
        }, null, 2) + "\n"
    );

    console.table(
        capped.map((record) => ({
            player: record.player,
            season: record.season,
            position: record.position,
            hitsPerGame: Number(record.hitsPerGame).toFixed(2),
            uncapped: record.uncappedPhysicalityBonus.toFixed(3),
            capped: record.physicalityBonus.toFixed(3)
        }))
    );

    console.log(
        `Saved ${bonuses.length} records; ${eligible.length} eligible ` +
        `season bonuses; ${capped.length} reduced by the cap.`
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
    calculatePhysicalitySeasonBonus
};