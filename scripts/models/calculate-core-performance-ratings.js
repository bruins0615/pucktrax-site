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
    addPercentileRatings
} = require("./calculate-offensive-ratings");

function calculateCorePerformanceIndex(offensiveIndex, defensiveIndex) {
    const { offense, defense } = MODEL_CONFIG.corePerformanceWeights;

    if (
        !Number.isFinite(offense) ||
        !Number.isFinite(defense) ||
        offense < 0 ||
        defense < 0 ||
        Math.abs(offense + defense - 1) > 1e-12
    ) {
        throw new Error(
            "Core performance weights must be nonnegative and sum to 1"
        );
    }

    for (const [label, value] of [
        ["offensive index", offensiveIndex],
        ["defensive index", defensiveIndex]
    ]) {
        if (value !== null && !Number.isFinite(value)) {
            throw new Error(`Invalid ${label}`);
        }
    }

    const eligible =
        offensiveIndex !== null &&
        defensiveIndex !== null;

    return {
        offensiveContribution:
            eligible ? offense * offensiveIndex : null,
        defensiveContribution:
            eligible ? defense * defensiveIndex : null,
        corePerformanceIndex:
            eligible
                ? offense * offensiveIndex + defense * defensiveIndex
                : null
    };
}

function buildCorePerformanceHistoricalScores(offenseRows, defenseRows) {
    const configuredSeasons =
        MODEL_CONFIG.historicalSeasons.map(String);

    function indexHistory(rows, label, scoreField) {
        const indexed = new Map();

        for (const row of rows) {
            const id = String(row.playerId);

            if (
                !/^[1-9]\d*$/.test(id) ||
                !["C", "L", "R", "D"].includes(row.position) ||
                typeof row.player !== "string" ||
                !row.player.trim() ||
                indexed.has(id)
            ) {
                throw new Error(`Invalid or duplicate ${label} player: ${id}`);
            }

            if (
                String(row.windowStart) !== configuredSeasons[0] ||
                String(row.windowEnd) !== configuredSeasons.at(-1)
            ) {
                throw new Error(`Unexpected ${label} historical window: ${id}`);
            }

            const included = String(row.includedSeasons ?? "")
                .split(",")
                .map((season) => season.trim())
                .filter(Boolean)
                .sort();

            const eligibleSeasons = requireNumber(
                row.eligibleSeasons,
                `${label} eligible seasons for ${id}`
            );

            if (
                !Number.isInteger(eligibleSeasons) ||
                eligibleSeasons !== included.length ||
                new Set(included).size !== included.length ||
                included.some(
                    (season) => !configuredSeasons.includes(season)
                )
            ) {
                throw new Error(`Invalid ${label} season coverage: ${id}`);
            }

            if (row[scoreField] === undefined) {
                throw new Error(`Missing ${label} index field: ${id}`);
            }

            const value = row[scoreField];
            const index =
                value === null ||
                    (typeof value === "string" && value.trim() === "")
                    ? null
                    : requireNumber(value, `${label} index for ${id}`);

            if (
                (eligibleSeasons === 0 && index !== null) ||
                (eligibleSeasons > 0 && index === null)
            ) {
                throw new Error(`Conflicting ${label} index and coverage: ${id}`);
            }

            indexed.set(id, {
                ...row,
                playerId: id,
                included,
                eligibleSeasons,
                index
            });
        }

        return indexed;
    }

    const offenseById = indexHistory(
        offenseRows,
        "offensive",
        "offensiveIndex"
    );

    const defenseById = indexHistory(
        defenseRows,
        "defensive",
        "defensiveIndex"
    );

    const ids = new Set([
        ...offenseById.keys(),
        ...defenseById.keys()
    ]);

    const combined = [...ids].map((id) => {
        const offense = offenseById.get(id);
        const defense = defenseById.get(id);
        const identity = offense ?? defense;

        let historyStatus = "Eligible";

        if (!offense || !defense) {
            historyStatus = "Missing category history";
        } else if (offense.position !== defense.position) {
            historyStatus = "Position mismatch";
        } else if (
            offense.included.join(",") !== defense.included.join(",")
        ) {
            historyStatus = "Season coverage mismatch";
        } else if (offense.index === null || defense.index === null) {
            historyStatus = "No eligible history";
        }

        const eligible = historyStatus === "Eligible";

        const score = calculateCorePerformanceIndex(
            eligible ? offense.index : null,
            eligible ? defense.index : null
        );

        return {
            playerId: id,
            player: identity.player,
            position: identity.position,
            windowStart: configuredSeasons[0],
            windowEnd: configuredSeasons.at(-1),
            offensivePosition: offense?.position ?? "",
            defensivePosition: defense?.position ?? "",
            offensiveEligibleSeasons: offense?.eligibleSeasons ?? null,
            defensiveEligibleSeasons: defense?.eligibleSeasons ?? null,
            offensiveIncludedSeasons: offense?.included.join(",") ?? "",
            defensiveIncludedSeasons: defense?.included.join(",") ?? "",
            eligibleSeasons: eligible ? offense.eligibleSeasons : 0,
            includedSeasons: eligible ? offense.included.join(",") : "",
            gamesPlayedInEligibleSeasons:
                eligible ? offense.gamesPlayedInEligibleSeasons : null,
            minutes5v5InEligibleSeasons:
                eligible ? offense.minutes5v5InEligibleSeasons : null,
            offensiveIndex: offense?.index ?? null,
            defensiveIndex: defense?.index ?? null,
            ...score,
            historyStatus
        };
    });

    return addPercentileRatings(
        combined,
        (record) => record.position,
        "corePerformanceIndex",
        "corePerformanceRating"
    );
}

function main() {
    const sourceFingerprints = [];

    function readSource(relativePath) {
        const contents = fs.readFileSync(path.resolve(relativePath));

        sourceFingerprints.push({
            path: relativePath,
            algorithm: "sha256",
            hash: createHash("sha256").update(contents).digest("hex"),
            bytes: contents.length
        });

        return contents.toString("utf8");
    }

    function readCsv(relativePath) {
        const rows = parse(readSource(relativePath), {
            columns: true,
            skip_empty_lines: true
        });

        if (!rows.length) {
            throw new Error(`Empty core source: ${relativePath}`);
        }

        return rows;
    }

    const offenseRows = readCsv(
        "data/offensive-ratings/historical-offensive-ratings.csv"
    );

    const defenseRows = readCsv(
        "data/defensive-ratings/historical-defensive-ratings.csv"
    );

    const offenseMetadata = JSON.parse(readSource(
        "data/offensive-ratings/model-metadata.json"
    ));

    const defenseMetadata = JSON.parse(readSource(
        "data/defensive-ratings/model-metadata.json"
    ));

    const configuredSeasons =
        MODEL_CONFIG.historicalSeasons.map(String);

    for (const [label, metadata, expectedVersion] of [
        ["offense", offenseMetadata, MODEL_CONFIG.modelVersion],
        ["defense", defenseMetadata, MODEL_CONFIG.defensiveModelVersion]
    ]) {
        if (
            metadata.modelVersion !== expectedVersion ||
            JSON.stringify(metadata.historicalSeasons?.map(String)) !==
            JSON.stringify(configuredSeasons) ||
            metadata.minimumMinutes5v5 !==
            MODEL_CONFIG.minimumMinutes5v5
        ) {
            throw new Error(
                `Saved ${label} settings differ from the current configuration.`
            );
        }
    }

    const results = buildCorePerformanceHistoricalScores(
        offenseRows,
        defenseRows
    ).sort((a, b) => Number(a.playerId) - Number(b.playerId));

    const reviewNames = [
        "Connor McDavid",
        "Nathan MacKinnon",
        "Nikita Kucherov",
        "Cale Makar",
        "Leon Draisaitl",
        "David Pastrnak",
        "Quinn Hughes",
        "Jack Eichel",
        "Adam Fox",
        "Aleksander Barkov",
        "Anthony Cirelli",
        "Jaccob Slavin",
        "Anze Kopitar",
        "Sidney Crosby",
        "Connor Bedard",
        "Mark Jankowski",
        "Jackson Blake",
        "Jesper Fast",
        "Pierre-Edouard Bellemare",
        "Dominic James",
        "Brock Boeser",
        "Trent Frederic",
        "Jake Evans",
        "John Leonard"
    ];

    const review = reviewNames.map((name) => {
        const matches = results.filter((record) => record.player === name);

        if (matches.length !== 1) {
            throw new Error(
                `Review sample requires one match for ${name}; ` +
                `found ${matches.length}.`
            );
        }

        return matches[0];
    });

    const statusCounts = {};

    for (const record of results) {
        statusCounts[record.historyStatus] =
            (statusCounts[record.historyStatus] ?? 0) + 1;
    }

    const directory = path.resolve("data/core-performance-ratings");
    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "historical-core-performance-ratings.csv"),
        stringify(results, { header: true })
    );

    atomicWrite(
        path.join(directory, "core-performance-review.csv"),
        stringify(review, { header: true })
    );

    atomicWrite(
        path.join(directory, "model-metadata.json"),
        JSON.stringify({
            modelVersion: MODEL_CONFIG.corePerformanceModelVersion,
            generatedAt: new Date().toISOString(),
            historicalSeasons: configuredSeasons,
            weights: MODEL_CONFIG.corePerformanceWeights,
            formula:
                "offense weight * historical offensive index + " +
                "defense weight * historical defensive index",
            inputModels: {
                offense: offenseMetadata.modelVersion,
                defense: defenseMetadata.modelVersion
            },
            aggregation:
                "Combines historical indices covering identical eligible seasons.",
            scaling:
                "Existing index scales; no additional standardization.",
            comparisonGroup:
                "Same latest recorded NHL position; eligible matched histories.",
            percentileMethod:
                "Midpoint percentile for ties using unrounded core indices.",
            ratingMethod:
                "Percentile divided by 10, rounded to one decimal.",
            missingDataPolicy:
                "Missing, mismatched and ineligible histories remain " +
                "ungraded. Missing category weights are not redistributed.",
            exclusions:
                "No discipline, faceoff, physicality or availability contribution.",
            interpretation:
                "Provisional positional performance composite, not " +
                "goals or wins contributed, contract value or projected ability.",
            limitations:
                "Component scales differ. Defensive inputs retain team " +
                "and deployment effects. Review sample is diagnostic, " +
                "not independent validation.",
            reviewPlayers: reviewNames,
            sourceFingerprints,
            outputCounts: {
                historicalPlayers: results.length,
                ratedPlayers: results.filter(
                    (record) => record.corePerformanceIndex !== null
                ).length,
                reviewPlayers: review.length,
                statusCounts
            }
        }, null, 2) + "\n"
    );

    function display(value, decimals) {
        return value === null ? "—" : Number(value).toFixed(decimals);
    }

    console.table(
        review.map((record) => ({
            player: record.player,
            position: record.position,
            seasons: record.eligibleSeasons,
            offenseIndex: display(record.offensiveIndex, 3),
            defenseIndex: display(record.defensiveIndex, 3),
            coreIndex: display(record.corePerformanceIndex, 3),
            coreRating: display(record.corePerformanceRating, 1),
            status: record.historyStatus
        }))
    );

    console.log(
        `Saved ${results.length} historical records; ` +
        `${statusCounts.Eligible ?? 0} eligible core ratings.`
    );

    console.log(`Saved ${review.length} fixed review records.`);
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
    calculateCorePerformanceIndex,
    buildCorePerformanceHistoricalScores
};