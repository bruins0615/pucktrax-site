const fs = require("node:fs");
const path = require("node:path");
const { stringify } = require("csv-stringify/sync");

const MODEL_CONFIG = require("../../config/model-config");

const {
    fetchReport,
    indexReport,
    calculateBaselines,
    atomicWrite
} = require("./collect-league-reference");

const PHYSICALITY_METRICS = ["hitsPerGame"];

function buildPhysicalityReference(shooting, realtime, iceTime, season) {
    const shootingById = indexReport(shooting, season);
    const realtimeById = indexReport(realtime, season);
    const iceTimeById = indexReport(iceTime, season);

    const sameCoverage = [realtimeById, iceTimeById].every(
        (report) =>
            report.size === shootingById.size &&
            [...shootingById.keys()].every((id) => report.has(id))
    );

    if (!sameCoverage) {
        throw new Error(`Physicality report coverage differs for ${season}`);
    }

    return [...shootingById.values()].map((shots) => {
        const actions = realtimeById.get(shots.playerId);
        const time = iceTimeById.get(shots.playerId);
        const identity = `${shots.playerId}-${season}`;

        if (
            !["C", "L", "R", "D"].includes(shots.positionCode) ||
            !Number.isInteger(shots.gamesPlayed) ||
            shots.gamesPlayed <= 0 ||
            actions.gamesPlayed !== shots.gamesPlayed ||
            time.gamesPlayed !== shots.gamesPlayed ||
            actions.positionCode !== shots.positionCode ||
            time.positionCode !== shots.positionCode
        ) {
            throw new Error(`Physicality identity mismatch: ${identity}`);
        }

        if (
            !Number.isFinite(shots.timeOnIcePerGame5v5) ||
            shots.timeOnIcePerGame5v5 < 0 ||
            !Number.isFinite(time.timeOnIce) ||
            time.timeOnIce < 0
        ) {
            throw new Error(`Invalid physicality ice time: ${identity}`);
        }

        const minutes5v5 =
            shots.timeOnIcePerGame5v5 * shots.gamesPlayed / 60;

        const eligible =
            minutes5v5 >= MODEL_CONFIG.minimumMinutes5v5;

        const hits = actions.hits;

        if (hits == null && eligible) {
            throw new Error(`Missing eligible hit count: ${identity}`);
        }

        if (hits != null && (!Number.isInteger(hits) || hits < 0)) {
            throw new Error(`Invalid hit count: ${identity}`);
        }

        if (
            time.timeOnIce === 0 &&
            (eligible || (hits != null && hits > 0))
        ) {
            throw new Error(`Hits or eligibility without ice time: ${identity}`);
        }

        return {
            season,
            playerId: shots.playerId,
            player: shots.skaterFullName,
            position: shots.positionCode,
            gamesPlayed: shots.gamesPlayed,
            estimatedMinutes5v5: minutes5v5,
            allSituationsMinutes: time.timeOnIce / 60,
            sampleStatus: eligible ? "Eligible" : "Limited sample",
            hits: hits ?? null,
            hitsPerGame:
                hits == null ? null : hits / shots.gamesPlayed,
            hitsPer60AllSituations:
                hits == null || time.timeOnIce === 0
                    ? null
                    : hits * 3600 / time.timeOnIce
        };
    });
}

async function main() {
    const rows = [];
    const sources = [];

    for (const season of MODEL_CONFIG.historicalSeasons) {
        const shooting = await fetchReport("summaryshooting", season);
        const realtime = await fetchReport("realtime", season);
        const iceTime = await fetchReport("timeonice", season);

        const reference = buildPhysicalityReference(
            shooting,
            realtime,
            iceTime,
            season
        );

        rows.push(...reference);

        sources.push({
            season,
            shootingRows: shooting.length,
            realtimeRows: realtime.length,
            iceTimeRows: iceTime.length
        });

        console.log(
            `${season}: ${reference.length} matched; ` +
            `${reference.filter((row) => row.sampleStatus === "Eligible").length} eligible.`
        );
    }

    rows.sort(
        (a, b) =>
            a.season - b.season ||
            a.position.localeCompare(b.position) ||
            a.playerId - b.playerId
    );

    const baselines = calculateBaselines(rows, PHYSICALITY_METRICS);
    const directory = path.resolve("data/league-reference");

    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "physicality-skaters.csv"),
        stringify(rows, { header: true })
    );

    atomicWrite(
        path.join(directory, "physicality-baselines.csv"),
        stringify(baselines, { header: true })
    );

    atomicWrite(
        path.join(directory, "physicality-metadata.json"),
        JSON.stringify({
            collectedAt: new Date().toISOString(),
            seasons: MODEL_CONFIG.historicalSeasons,
            gameTypeId: 2,
            minimumMinutes5v5: MODEL_CONFIG.minimumMinutes5v5,
            reports: ["summaryshooting", "realtime", "timeonice"],
            sources,
            metrics: PHYSICALITY_METRICS,
            situations: "Hits include all situations.",
            denominators: {
                eligibility:
                    "summaryshooting.timeOnIcePerGame5v5 * gamesPlayed / 60",
                hitsPerGame: "All recorded games played",
                hitsPer60AllSituations:
                    "Exact total seconds from timeonice.timeOnIce"
            },
            baselineGrouping: "Same season and NHL position",
            weighting: "Each eligible player equally weighted",
            standardDeviation: "Population",
            missingDataPolicy:
                "Eligible records require valid hit counts. " +
                "Below-cutoff missing counts remain unavailable. " +
                "Recorded zero remains zero.",
            note:
                "Reference statistics only; no bonus calculated. " +
                "Hits/game is the scoring candidate. Hits/60 is context only. " +
                "Counts do not establish hit effectiveness or isolated value."
        }, null, 2) + "\n"
    );

    console.table(
        baselines.map((row) => ({
            season: row.season,
            position: row.position,
            players: row.eligiblePlayers,
            averageHitsPerGame: row.mean.toFixed(3),
            standardDeviation:
                row.populationStandardDeviation.toFixed(3)
        }))
    );

    console.log(
        `Saved ${rows.length} records and ${baselines.length} physicality baselines.`
    );
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    buildPhysicalityReference,
    PHYSICALITY_METRICS
};