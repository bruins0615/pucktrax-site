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
    buildParticipationRecord
} = require("../collectors/collect-availability-reference");

const {
    requireNumber
} = require("./calculate-offensive-ratings");

function calculateAvailabilitySeasonGrade(record) {
    const {
        participationStatus,
        coverageStatus,
        careerGamesEnteringSeason,
        gamesPlayed
    } = record;

    const validStatuses = [
        "Eligible",
        "Below veteran minimum",
        "Unresolved",
        "Not applicable"
    ];

    if (!validStatuses.includes(participationStatus)) {
        throw new Error("Invalid participation status");
    }

    if (
        !Number.isInteger(careerGamesEnteringSeason) ||
        careerGamesEnteringSeason < 0
    ) {
        throw new Error("Invalid entering career games");
    }

    const validCoverage = [
        "Recorded appearances",
        "Verified zero",
        "Unresolved",
        "Outside NHL involvement"
    ];

    if (!validCoverage.includes(coverageStatus)) {
        throw new Error("Invalid coverage status");
    }

    const expectedStatus =
        coverageStatus === "Outside NHL involvement"
            ? "Not applicable"
            : careerGamesEnteringSeason <
                MODEL_CONFIG.minimumCareerGamesForAvailability
                ? "Below veteran minimum"
                : coverageStatus === "Unresolved"
                    ? "Unresolved"
                    : "Eligible";

    if (participationStatus !== expectedStatus) {
        throw new Error("Participation status conflicts with eligibility");
    }

    if (
        coverageStatus === "Unresolved" ||
        coverageStatus === "Outside NHL involvement"
    ) {
        if (gamesPlayed !== null) {
            throw new Error("Unresolved or excluded games must remain null");
        }

        return null;
    }

    if (!Number.isInteger(gamesPlayed) || gamesPlayed < 0) {
        throw new Error("Invalid games played");
    }

    if (
        (coverageStatus === "Verified zero" && gamesPlayed !== 0) ||
        (coverageStatus === "Recorded appearances" && gamesPlayed === 0)
    ) {
        throw new Error("Games played conflicts with coverage status");
    }

    if (participationStatus !== "Eligible") {
        return null;
    }

    return Math.min(
        10,
        gamesPlayed / MODEL_CONFIG.availabilityFullCreditGames * 10
    );
}

function buildAvailabilityHistoricalScores(records) {
    const seasons = new Set(
        MODEL_CONFIG.historicalSeasons.map(String)
    );

    const groups = new Map();
    const seen = new Set();

    for (const record of records) {
        if (!seasons.has(String(record.season))) {
            continue;
        }

        const key = `${record.playerId}-${record.season}`;

        if (seen.has(key)) {
            throw new Error(`Duplicate participation record: ${key}`);
        }

        seen.add(key);

        const seasonGrade =
            calculateAvailabilitySeasonGrade(record);

        const playerKey = String(record.playerId);

        if (!groups.has(playerKey)) {
            groups.set(playerKey, []);
        }

        groups.get(playerKey).push({
            ...record,
            seasonGrade
        });
    }

    return [...groups.values()].map((history) => {
        history.sort(
            (a, b) => Number(b.season) - Number(a.season)
        );

        const latest = history[0];
        const eligible = history.filter(
            (record) => record.seasonGrade !== null
        );

        const unresolved = history.filter(
            (record) => record.participationStatus === "Unresolved"
        );

        const excluded = history.filter(
            (record) => record.participationStatus === "Not applicable"
        );

        const availabilityRating = eligible.length
            ? eligible.reduce(
                (sum, record) => sum + record.seasonGrade,
                0
            ) / eligible.length
            : null;

        return {
            playerId: latest.playerId,
            player: latest.player,
            position: latest.position,
            eligibleSeasons: eligible.length,
            includedSeasons: eligible
                .map((record) => record.season)
                .join(","),
            unresolvedSeasons: unresolved.length,
            excludedSeasons: excluded.length,
            availabilityRating,
            historyStatus: unresolved.length
                ? "Incomplete coverage"
                : eligible.length
                    ? "Available"
                    : "No eligible seasons"
        };
    });
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

    const sourceCsv = readSource(
        "data/league-reference/availability-skaters.csv"
    );

    const sourceMetadata = JSON.parse(readSource(
        "data/league-reference/availability-metadata.json"
    ));

    if (
        JSON.stringify(sourceMetadata.seasons) !==
        JSON.stringify(MODEL_CONFIG.historicalSeasons) ||
        sourceMetadata.minimumCareerGames !==
        MODEL_CONFIG.minimumCareerGamesForAvailability
    ) {
        throw new Error(
            "Availability collection settings differ from model settings. " +
            "Rerun the availability collector."
        );
    }

    const rawRecords = parse(sourceCsv, {
        columns: true,
        skip_empty_lines: true
    });

    if (!rawRecords.length) {
        throw new Error("Empty availability reference file");
    }

    const records = rawRecords.map((raw) => {
        const identity = `${raw.playerId}-${raw.season}`;
        const season = requireNumber(raw.season, identity);
        const playerId = requireNumber(raw.playerId, identity);

        if (
            !Number.isInteger(playerId) ||
            playerId <= 0 ||
            !MODEL_CONFIG.historicalSeasons.includes(season) ||
            !["C", "L", "R", "D"].includes(raw.position) ||
            typeof raw.player !== "string" ||
            !raw.player.trim()
        ) {
            throw new Error(`Invalid availability identity: ${identity}`);
        }

        const record = {
            ...raw,
            season,
            playerId,
            careerGamesEnteringSeason: requireNumber(
                raw.careerGamesEnteringSeason,
                `entering career games for ${identity}`
            ),
            gamesPlayed:
                raw.gamesPlayed == null ||
                    raw.gamesPlayed.trim() === ""
                    ? null
                    : requireNumber(
                        raw.gamesPlayed,
                        `games played for ${identity}`
                    )
        };

        const validated = buildParticipationRecord(record);

        if (
            record.participationStatus !==
            validated.participationStatus
        ) {
            throw new Error(
                `Saved participation status conflicts with rules: ${identity}`
            );
        }

        return record;
    });

    // Historical calculation also checks for duplicate player-seasons.
    const historical = buildAvailabilityHistoricalScores(records);

    const seasonRatings = records.map((record) => ({
        ...record,
        availabilityRating: calculateAvailabilitySeasonGrade(record)
    }));

    seasonRatings.sort(
        (a, b) => a.season - b.season || a.playerId - b.playerId
    );

    historical.sort((a, b) => a.playerId - b.playerId);

    const directory = path.resolve("data/availability-ratings");

    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "season-availability-ratings.csv"),
        stringify(seasonRatings, { header: true })
    );

    atomicWrite(
        path.join(directory, "historical-availability-ratings.csv"),
        stringify(historical, { header: true })
    );

    const eligibleSeasonCount = seasonRatings.filter(
        (record) => record.availabilityRating !== null
    ).length;

    const ratedHistoricalCount = historical.filter(
        (record) => record.availabilityRating !== null
    ).length;

    const incompleteHistoricalCount = historical.filter(
        (record) => record.historyStatus === "Incomplete coverage"
    ).length;

    atomicWrite(
        path.join(directory, "model-metadata.json"),
        JSON.stringify({
            modelVersion: MODEL_CONFIG.availabilityModelVersion,
            generatedAt: new Date().toISOString(),
            historicalSeasons: MODEL_CONFIG.historicalSeasons,
            minimumCareerGames:
                MODEL_CONFIG.minimumCareerGamesForAvailability,
            fullCreditGames:
                MODEL_CONFIG.availabilityFullCreditGames,
            seasonFormula: "min(10, gamesPlayed / fullCreditGames * 10)",
            historicalFormula:
                "Equal average of unrounded eligible season grades",
            gradingMethod: "Fixed benchmark, not percentile",
            precision:
                "Full precision saved. Display grades to one decimal.",
            missingDataPolicy:
                "Verified zero receives 0.0. Below-minimum, unresolved " +
                "and outside-NHL seasons remain ungraded. Historical " +
                "averages with unresolved veteran seasons are flagged " +
                "as incomplete coverage.",
            candidateCoverage: sourceMetadata.candidateCoverage,
            sourceFingerprints,
            outputCounts: {
                seasonRecords: seasonRatings.length,
                eligibleSeasonGrades: eligibleSeasonCount,
                historicalPlayers: historical.length,
                ratedHistoricalPlayers: ratedHistoricalCount,
                incompleteHistoricalPlayers: incompleteHistoricalCount
            },
            note:
                "Measures regular-season participation regardless of " +
                "absence reason. No overall-value contribution assigned."
        }, null, 2) + "\n"
    );

    const examplePlayers = new Set([
        "Nick Suzuki",
        "Patrik Laine",
        "Gabriel Landeskog",
        "Evander Kane",
        "Aleksander Barkov",
        "Jeff Carter"
    ]);

    console.table(
        historical
            .filter((record) => examplePlayers.has(record.player))
            .map((record) => ({
                player: record.player,
                eligibleSeasons: record.eligibleSeasons,
                availabilityRating:
                    record.availabilityRating === null
                        ? "—"
                        : record.availabilityRating.toFixed(1),
                unresolvedSeasons: record.unresolvedSeasons,
                excludedSeasons: record.excludedSeasons,
                status: record.historyStatus
            }))
    );

    console.log(
        `Saved ${seasonRatings.length} season records; ` +
        `${eligibleSeasonCount} eligible season grades.`
    );

    console.log(
        `${ratedHistoricalCount} rated historical players; ` +
        `${incompleteHistoricalCount} historical profiles ` +
        `with unresolved coverage.`
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
    calculateAvailabilitySeasonGrade,
    buildAvailabilityHistoricalScores
};