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

function calculatePerformanceIndex(coreIndex, disciplineIndex) {
    const coefficient = MODEL_CONFIG.disciplineAdjustmentCoefficient;

    if (!Number.isFinite(coefficient) || coefficient < 0) {
        throw new Error(
            "Discipline adjustment coefficient must be nonnegative"
        );
    }

    for (const [label, value] of [
        ["core index", coreIndex],
        ["discipline index", disciplineIndex]
    ]) {
        if (value !== null && !Number.isFinite(value)) {
            throw new Error(`Invalid ${label}`);
        }
    }

    if (coreIndex === null || disciplineIndex === null) {
        return {
            disciplineAdjustment: null,
            performanceIndex: null
        };
    }

    const disciplineAdjustment = coefficient * disciplineIndex;

    return {
        disciplineAdjustment,
        performanceIndex: coreIndex + disciplineAdjustment
    };
}

function buildPerformanceHistoricalScores(coreRows, disciplineRows) {
    const seasons = MODEL_CONFIG.historicalSeasons.map(String);

    function indexHistory(rows, label, indexField) {
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
                String(row.windowStart) !== seasons[0] ||
                String(row.windowEnd) !== seasons.at(-1)
            ) {
                throw new Error(`Unexpected ${label} historical window: ${id}`);
            }

            const included = String(row.includedSeasons ?? "")
                .split(",")
                .map((season) => season.trim())
                .filter(Boolean)
                .sort();

            const count = requireNumber(
                row.eligibleSeasons,
                `${label} eligible seasons for ${id}`
            );

            if (
                !Number.isInteger(count) ||
                count !== included.length ||
                new Set(included).size !== included.length ||
                included.some((season) => !seasons.includes(season))
            ) {
                throw new Error(`Invalid ${label} season coverage: ${id}`);
            }

            if (row[indexField] === undefined) {
                throw new Error(`Missing ${label} index field: ${id}`);
            }

            const value = row[indexField];
            const index =
                value === null ||
                    (typeof value === "string" && value.trim() === "")
                    ? null
                    : requireNumber(value, `${label} index for ${id}`);

            if (
                (count === 0 && index !== null) ||
                (count > 0 && index === null)
            ) {
                throw new Error(`Conflicting ${label} index and coverage: ${id}`);
            }

            indexed.set(id, {
                row,
                included,
                count,
                index
            });
        }

        return indexed;
    }

    const coreById = indexHistory(
        coreRows,
        "core",
        "corePerformanceIndex"
    );

    const disciplineById = indexHistory(
        disciplineRows,
        "discipline",
        "disciplineIndex"
    );

    const ids = new Set([
        ...coreById.keys(),
        ...disciplineById.keys()
    ]);

    const combined = [...ids].map((id) => {
        const core = coreById.get(id);
        const discipline = disciplineById.get(id);
        const identity = core?.row ?? discipline.row;

        let historyStatus = "Eligible";

        if (!core || !discipline) {
            historyStatus = "Missing category history";
        } else if (core.row.position !== discipline.row.position) {
            historyStatus = "Position mismatch";
        } else if (
            core.included.join(",") !== discipline.included.join(",")
        ) {
            historyStatus = "Season coverage mismatch";
        } else if (core.index === null || discipline.index === null) {
            historyStatus = "No eligible matched history";
        }

        const eligible = historyStatus === "Eligible";

        const calculation = calculatePerformanceIndex(
            eligible ? core.index : null,
            eligible ? discipline.index : null
        );

        return {
            playerId: id,
            player: identity.player,
            position: identity.position,
            windowStart: seasons[0],
            windowEnd: seasons.at(-1),
            corePosition: core?.row.position ?? "",
            disciplinePosition: discipline?.row.position ?? "",
            coreEligibleSeasons: core?.count ?? null,
            disciplineEligibleSeasons: discipline?.count ?? null,
            coreIncludedSeasons: core?.included.join(",") ?? "",
            disciplineIncludedSeasons: discipline?.included.join(",") ?? "",
            eligibleSeasons: eligible ? core.count : 0,
            includedSeasons: eligible ? core.included.join(",") : "",
            gamesPlayedInEligibleSeasons:
                eligible ? core.row.gamesPlayedInEligibleSeasons : null,
            minutes5v5InEligibleSeasons:
                eligible ? core.row.minutes5v5InEligibleSeasons : null,
            corePerformanceIndex: core?.index ?? null,
            corePerformanceRating: core?.row.corePerformanceRating ?? null,
            disciplineIndex: discipline?.index ?? null,
            ...calculation,
            historyStatus
        };
    });

    return addPercentileRatings(
        combined,
        (record) => record.position,
        "performanceIndex",
        "performanceRating"
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
            throw new Error(`Empty Performance source: ${relativePath}`);
        }

        return rows;
    }

    const coreRows = readCsv(
        "data/core-performance-ratings/historical-core-performance-ratings.csv"
    );

    const disciplineRows = readCsv(
        "data/discipline-ratings/historical-discipline-ratings.csv"
    );

    const faceoffRows = readCsv(
        "data/faceoff-ratings/season-faceoff-indices.csv"
    );

    const faceoffMetadata = JSON.parse(readSource(
        "data/faceoff-ratings/model-metadata.json"
    ));

    const coreMetadata = JSON.parse(readSource(
        "data/core-performance-ratings/model-metadata.json"
    ));

    const disciplineMetadata = JSON.parse(readSource(
        "data/discipline-ratings/model-metadata.json"
    ));

    const configuredSeasons =
        MODEL_CONFIG.historicalSeasons.map(String);

    for (const [label, metadata, expectedVersion] of [
        ["Core", coreMetadata, MODEL_CONFIG.corePerformanceModelVersion],
        ["Discipline", disciplineMetadata, MODEL_CONFIG.disciplineModelVersion],
        ["Faceoffs", faceoffMetadata, MODEL_CONFIG.faceoffModelVersion]
    ]) {
        if (
            metadata.modelVersion !== expectedVersion ||
            JSON.stringify(metadata.historicalSeasons?.map(String)) !==
            JSON.stringify(configuredSeasons)
        ) {
            throw new Error(
                `Saved ${label} version or historical window differs ` +
                "from the current configuration."
            );
        }
    }

    const savedWeights = coreMetadata.weights;

    if (
        savedWeights?.offense !== MODEL_CONFIG.corePerformanceWeights.offense ||
        savedWeights?.defense !== MODEL_CONFIG.corePerformanceWeights.defense
    ) {
        throw new Error(
            "Saved Core weights differ from the current configuration."
        );
    }

    const disciplineResults = buildPerformanceHistoricalScores(
        coreRows,
        disciplineRows
    );

    const results = applyHistoricalFaceoffAdjustments(
        disciplineResults,
        faceoffRows
    ).sort((a, b) => Number(a.playerId) - Number(b.playerId));

    const reviewNames = [
        "Jaccob Slavin",
        "Cale Makar",
        "David Pastrnak",
        "Brad Marchand",
        "Nikita Zadorov",
        "Mark Kastelic",
        "Connor McDavid",
        "Sidney Crosby",
        "Anthony Cirelli",
        "Claude Giroux",
        "Jordan Staal",
        "Elias Lindholm",
        "Pavel Zacha",
        "Leo Carlsson",
        "Connor Bedard",
        "Logan Cooley"
    ];

    const review = reviewNames.map((name) => {
        const matches = results.filter((record) => record.player === name);

        if (matches.length !== 1) {
            throw new Error(
                `Performance review requires one match for ${name}; ` +
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

    const eligible = results.filter(
        (record) => record.performanceIndex !== null
    );

    const directory = path.resolve("data/performance-ratings");
    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "historical-performance-ratings.csv"),
        stringify(results, { header: true })
    );

    atomicWrite(
        path.join(directory, "performance-review.csv"),
        stringify(review, { header: true })
    );

    atomicWrite(
        path.join(directory, "model-metadata.json"),
        JSON.stringify({
            modelVersion: MODEL_CONFIG.performanceModelVersion,
            generatedAt: new Date().toISOString(),
            historicalSeasons: configuredSeasons,
            disciplineAdjustmentCoefficient:
                MODEL_CONFIG.disciplineAdjustmentCoefficient,
            faceoffAdjustmentCoefficient:
                MODEL_CONFIG.faceoffAdjustmentCoefficient,
            coreWeights: savedWeights,
            formula:
                "historical Core index + discipline coefficient * " +
                "historical Discipline index + historical Faceoff adjustment",
            inputModels: {
                core: coreMetadata.modelVersion,
                discipline: disciplineMetadata.modelVersion,
                faceoffs: faceoffMetadata.modelVersion
            },
            aggregation:
                "Historical Core and Discipline indices must cover " +
                "identical eligible seasons and the same position.",
            comparisonGroup:
                "Same latest recorded NHL position; eligible matched histories.",
            percentileMethod:
                "Midpoint percentile for ties using unrounded Performance indices.",
            ratingMethod:
                "Percentile divided by 10, rounded to one decimal.",
            missingDataPolicy:
                "Missing, mismatched and ineligible histories remain ungraded. " +
                "Core results are preserved separately.",
            disciplinePolicy:
                "The Discipline index already includes the drawing bonus. " +
                "It is not added a second time. PIM includes fighting and " +
                "misconducts; this is not a power-play opportunity estimate.",
            faceoffPolicy:
                "Apply signed adjustments in qualifying Faceoff seasons " +
                "included in Core history. Divide their sum by all " +
                "qualifying Core seasons. Documented nonqualifying " +
                "seasons receive no adjustment; missing records fail.",
            excludedCategories:
                "No physicality or availability contribution.",
            interpretation:
                "Provisional descriptive performance composite, not contract " +
                "value, total season value delivered or projected ability.",
            reviewPlayers: reviewNames,
            sourceFingerprints,
            outputCounts: {
                historicalPlayers: results.length,
                ratedPlayers: eligible.length,
                positiveAdjustments: eligible.filter(
                    (record) => record.disciplineAdjustment > 0
                ).length,
                negativeAdjustments: eligible.filter(
                    (record) => record.disciplineAdjustment < 0
                ).length,
                zeroAdjustments: eligible.filter(
                    (record) => record.disciplineAdjustment === 0
                ).length,
                playersWithFaceoffSupport: eligible.filter(
                    (record) => record.faceoffSupportedSeasons > 0
                ).length,
                reviewPlayers: review.length,
                statusCounts
            },
            note:
                "Review outputs only. Existing Core files and website " +
                "grades are unchanged by this runner."
        }, null, 2) + "\n"
    );

    function display(value, decimals = 3) {
        return value == null || value === ""
            ? "—"
            : Number(value).toFixed(decimals);
    }

    console.table(
        review.map((record) => ({
            player: record.player,
            support:
                record.performanceIndex === null
                    ? "—"
                    : `${record.faceoffSupportedSeasons}/${record.eligibleSeasons}`,
            discipline: display(record.disciplineAdjustment),
            faceoffs: display(record.faceoffAdjustment),
            performanceIndex: display(record.performanceIndex),
            coreGrade: display(record.corePerformanceRating, 1),
            beforeFaceoffs: display(
                record.performanceBeforeFaceoffsRating,
                1
            ),
            performanceGrade: display(record.performanceRating, 1),
            status: record.historyStatus
        }))
    );

    console.log(
        `Saved ${results.length} historical records; ` +
        `${eligible.length} eligible Performance ratings.`
    );

    console.log(`Saved ${review.length} review records.`);
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

function calculateHistoricalFaceoffAdjustment(coreRecord, faceoffRows) {
    const coefficient = MODEL_CONFIG.faceoffAdjustmentCoefficient;

    if (!Number.isFinite(coefficient) || coefficient < 0) {
        throw new Error(
            "Faceoff adjustment coefficient must be nonnegative"
        );
    }

    const configuredSeasons =
        MODEL_CONFIG.historicalSeasons.map(String);

    const coreSeasons = String(coreRecord.includedSeasons ?? "")
        .split(",")
        .map((season) => season.trim())
        .filter(Boolean)
        .sort();

    const count = requireNumber(
        coreRecord.eligibleSeasons,
        "Core eligible seasons for Faceoff adjustment"
    );

    if (
        !Number.isInteger(count) ||
        count <= 0 ||
        count !== coreSeasons.length ||
        new Set(coreSeasons).size !== coreSeasons.length ||
        coreSeasons.some(
            (season) => !configuredSeasons.includes(season)
        )
    ) {
        throw new Error("Invalid Core coverage for Faceoff adjustment");
    }

    const playerId = String(coreRecord.playerId);
    const bySeason = new Map();

    for (const row of faceoffRows) {
        if (String(row.playerId) !== playerId) continue;

        const season = String(row.season);

        if (!coreSeasons.includes(season)) continue;

        if (bySeason.has(season)) {
            throw new Error(
                `Duplicate faceoff record: ${playerId}-${season}`
            );
        }

        bySeason.set(season, row);
    }

    const supportedSeasons = [];
    let adjustmentSum = 0;

    for (const season of coreSeasons) {
        const record = bySeason.get(season);
        const identity = `${playerId}-${season}`;

        if (!record) {
            throw new Error(`Missing faceoff record: ${identity}`);
        }

        const validStatuses = [
            "Eligible",
            "Limited sample",
            "Incomplete zone sample",
            "Not applicable"
        ];

        if (!validStatuses.includes(record.sampleStatus)) {
            throw new Error(`Invalid faceoff status: ${identity}`);
        }

        if (record.faceoffIndex === undefined) {
            throw new Error(`Missing faceoff index field: ${identity}`);
        }

        const value = record.faceoffIndex;
        const missing =
            value === null ||
            (typeof value === "string" && value.trim() === "");

        if (record.sampleStatus !== "Eligible") {
            if (!missing) {
                throw new Error(
                    `Ungraded faceoff season has an index: ${identity}`
                );
            }

            continue;
        }

        const index = requireNumber(
            value,
            `eligible faceoff index for ${identity}`
        );

        adjustmentSum += coefficient * index;
        supportedSeasons.push(season);
    }

    return {
        faceoffSupportedSeasons: supportedSeasons.length,
        faceoffIncludedSeasons: supportedSeasons.join(","),
        faceoffAdjustment: adjustmentSum / coreSeasons.length
    };
}

function applyHistoricalFaceoffAdjustments(performanceRows, faceoffRows) {
    const adjusted = performanceRows.map((record) => {
        const beforeIndex = record.performanceIndex;
        const beforeRating = record.performanceRating;

        if (beforeIndex === null) {
            return {
                ...record,
                performanceBeforeFaceoffsIndex: null,
                performanceBeforeFaceoffsRating: null,
                faceoffSupportedSeasons: null,
                faceoffIncludedSeasons: "",
                faceoffAdjustment: null
            };
        }

        if (!Number.isFinite(beforeIndex)) {
            throw new Error(
                `Invalid Performance index for ${record.playerId}`
            );
        }

        const adjustment = calculateHistoricalFaceoffAdjustment(
            record,
            faceoffRows
        );

        return {
            ...record,
            performanceBeforeFaceoffsIndex: beforeIndex,
            performanceBeforeFaceoffsRating: beforeRating,
            ...adjustment,
            performanceIndex: beforeIndex + adjustment.faceoffAdjustment
        };
    });

    return addPercentileRatings(
        adjusted,
        (record) => record.position,
        "performanceIndex",
        "performanceRating"
    );
}

function calculateHistoricalPhysicalityBonus(coreRecord, physicalityRows) {
    const configuredSeasons =
        MODEL_CONFIG.historicalSeasons.map(String);

    const seasons = String(coreRecord.includedSeasons ?? "")
        .split(",")
        .map((season) => season.trim())
        .filter(Boolean)
        .sort();

    const count = requireNumber(
        coreRecord.eligibleSeasons,
        "Core eligible seasons for Physicality"
    );

    if (
        !Number.isInteger(count) ||
        count <= 0 ||
        count !== seasons.length ||
        new Set(seasons).size !== seasons.length ||
        seasons.some((season) => !configuredSeasons.includes(season))
    ) {
        throw new Error("Invalid Core coverage for Physicality");
    }

    const cap = MODEL_CONFIG.physicalityBonusCap;

    if (!Number.isFinite(cap) || cap < 0) {
        throw new Error("Invalid Physicality cap");
    }

    const playerId = String(coreRecord.playerId);
    const bySeason = new Map();

    for (const row of physicalityRows) {
        if (String(row.playerId) !== playerId) continue;

        const season = String(row.season);
        if (!seasons.includes(season)) continue;

        if (bySeason.has(season)) {
            throw new Error(
                `Duplicate Physicality record: ${playerId}-${season}`
            );
        }

        bySeason.set(season, row);
    }

    let total = 0;
    let positiveSeasons = 0;

    for (const season of seasons) {
        const record = bySeason.get(season);
        const identity = `${playerId}-${season}`;

        if (!record) {
            throw new Error(`Missing Physicality record: ${identity}`);
        }

        if (record.sampleStatus !== "Eligible") {
            throw new Error(
                `Physicality eligibility differs from Core: ${identity}`
            );
        }

        const bonus = requireNumber(
            record.physicalityBonus,
            `Physicality bonus for ${identity}`
        );

        if (bonus < 0 || bonus > cap) {
            throw new Error(`Physicality bonus outside cap: ${identity}`);
        }

        total += bonus;
        if (bonus > 0) positiveSeasons++;
    }

    return {
        physicalitySupportedSeasons: seasons.length,
        physicalityIncludedSeasons: seasons.join(","),
        physicalityPositiveSeasons: positiveSeasons,
        historicalPhysicalityBonus: total / seasons.length
    };
}

module.exports = {
    calculatePerformanceIndex,
    buildPerformanceHistoricalScores,
    calculateHistoricalFaceoffAdjustment,
    applyHistoricalFaceoffAdjustments,
    calculateHistoricalPhysicalityBonus
};