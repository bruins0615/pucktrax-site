const fs = require("node:fs");
const path = require("node:path");
const { stringify } = require("csv-stringify/sync");

const MODEL_CONFIG = require("../../config/model-config");

const {
    indexReport,
    fetchReport,
    calculateBaselines,
    atomicWrite
} = require("./collect-league-reference");

const DISCIPLINE_METRICS = [
    "penaltyMinutesPerGame",
    "penaltiesDrawnPerGame"
];

function buildDisciplineReference(shooting, penalties, season) {
    const shootingById = indexReport(shooting, season);
    const penaltiesById = indexReport(penalties, season);

    if (
        shootingById.size !== penaltiesById.size ||
        [...shootingById.keys()].some((id) => !penaltiesById.has(id))
    ) {
        throw new Error(`Report coverage differs for ${season}`);
    }

    return [...shootingById.values()].map((shots) => {
        const penalty = penaltiesById.get(shots.playerId);
        const identity = `${shots.playerId}-${season}`;

        if (
            !["C", "L", "R", "D"].includes(shots.positionCode) ||
            !Number.isInteger(shots.gamesPlayed) ||
            shots.gamesPlayed <= 0 ||
            penalty.gamesPlayed !== shots.gamesPlayed ||
            penalty.positionCode !== shots.positionCode
        ) {
            throw new Error(`Position or games mismatch: ${identity}`);
        }

        if (
            !Number.isFinite(shots.timeOnIcePerGame5v5) ||
            shots.timeOnIcePerGame5v5 < 0
        ) {
            throw new Error(`Invalid five-on-five ice time: ${identity}`);
        }

        const minutes =
            shots.timeOnIcePerGame5v5 * shots.gamesPlayed / 60;

        const eligible =
            minutes >= MODEL_CONFIG.minimumMinutes5v5;

        const counts = {};

        for (const field of [
            "penaltyMinutes",
            "penalties",
            "penaltiesDrawn",
            "netPenalties"
        ]) {
            const value = penalty[field];

            if (value == null) {
                if (eligible) {
                    throw new Error(
                        `Missing eligible discipline input: ${field}, ${identity}`
                    );
                }

                counts[field] = null;
                continue;
            }

            if (
                !Number.isInteger(value) ||
                (field !== "netPenalties" && value < 0)
            ) {
                throw new Error(
                    `Invalid discipline count: ${field}, ${identity}`
                );
            }

            counts[field] = value;
        }

        if (
            counts.penalties !== null &&
            counts.penaltiesDrawn !== null &&
            counts.netPenalties !== null &&
            counts.netPenalties !==
            counts.penaltiesDrawn - counts.penalties
        ) {
            throw new Error(`Net penalties mismatch: ${identity}`);
        }

        return {
            season,
            playerId: shots.playerId,
            player: shots.skaterFullName,
            position: shots.positionCode,
            gamesPlayed: shots.gamesPlayed,
            estimatedMinutes5v5: minutes,
            sampleStatus: eligible ? "Eligible" : "Limited sample",
            penaltyMinutes: counts.penaltyMinutes,
            penaltyMinutesPerGame:
                counts.penaltyMinutes === null
                    ? null
                    : counts.penaltyMinutes / shots.gamesPlayed,
            penaltiesTaken: counts.penalties,
            penaltiesDrawn: counts.penaltiesDrawn,
            penaltiesDrawnPerGame:
                counts.penaltiesDrawn === null
                    ? null
                    : counts.penaltiesDrawn / shots.gamesPlayed,
            netPenalties: counts.netPenalties
        };
    });
}

async function main() {
    const rows = [];
    const sources = [];

    for (const season of MODEL_CONFIG.historicalSeasons) {
        const shooting = await fetchReport("summaryshooting", season);
        const penalties = await fetchReport("penalties", season);

        const reference = buildDisciplineReference(
            shooting,
            penalties,
            season
        );

        rows.push(...reference);

        sources.push({
            season,
            shootingRows: shooting.length,
            penaltyRows: penalties.length
        });

        const eligible = reference.filter(
            (row) => row.sampleStatus === "Eligible"
        ).length;

        console.log(
            `${season}: ${reference.length} matched; ${eligible} eligible.`
        );
    }

    rows.sort(
        (a, b) =>
            a.season - b.season ||
            a.position.localeCompare(b.position) ||
            a.playerId - b.playerId
    );

    const baselines = calculateBaselines(rows, DISCIPLINE_METRICS);
    const directory = path.resolve("data/league-reference");

    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "discipline-skaters.csv"),
        stringify(rows, { header: true })
    );

    atomicWrite(
        path.join(directory, "discipline-baselines.csv"),
        stringify(baselines, { header: true })
    );

    atomicWrite(
        path.join(directory, "discipline-metadata.json"),
        JSON.stringify({
            collectedAt: new Date().toISOString(),
            seasons: MODEL_CONFIG.historicalSeasons,
            gameTypeId: 2,
            minimumMinutes5v5: MODEL_CONFIG.minimumMinutes5v5,
            reports: ["summaryshooting", "penalties"],
            sources,
            metrics: DISCIPLINE_METRICS,
            denominators: {
                eligibility:
                    "summaryshooting.timeOnIcePerGame5v5 * gamesPlayed / 60",
                scoringInputs: "All recorded games played"
            },
            situations: "Penalty measures include all situations and types.",
            standardDeviation: "Population",
            weighting:
                "Each eligible skater equally weighted within season and NHL position",
            missingDataPolicy:
                "Eligible records require valid counts. Below-cutoff missing " +
                "values remain unavailable. Recorded zero remains zero.",
            netPenaltyPolicy:
                "Penalties drawn minus penalties taken; display context only.",
            note:
                "Reference data only; no indices or grades calculated. " +
                "Penalty counts and minutes do not equal power-play opportunities."
        }, null, 2) + "\n"
    );

    console.table(
        baselines.map((row) => ({
            season: row.season,
            position: row.position,
            metric: row.metric,
            players: row.eligiblePlayers,
            average: row.mean.toFixed(3),
            standardDeviation:
                row.populationStandardDeviation.toFixed(3)
        }))
    );

    console.log(
        `Saved ${rows.length} records and ${baselines.length} discipline baselines.`
    );
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    buildDisciplineReference,
    DISCIPLINE_METRICS
};