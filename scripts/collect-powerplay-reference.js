const fs = require("node:fs");
const path = require("node:path");
const { stringify } = require("csv-stringify/sync");

const {
    fetchReport,
    indexReport,
    atomicWrite,
    calculateBaselines
} = require("./collect-league-reference");

const SEASONS = [20232024, 20242025, 20252026];

const PP_METRICS = ["powerPlayPointsPerGame"];

function buildPowerPlayReference(summary, iceTime, season) {
    const summaryById = indexReport(summary, season);
    const iceTimeById = indexReport(iceTime, season);

    const sameCoverage =
        summaryById.size === iceTimeById.size &&
        [...summaryById.keys()].every((id) => iceTimeById.has(id));

    if (!sameCoverage) {
        throw new Error(`Report coverage differs for ${season}`);
    }

    return [...summaryById.values()].map((player) => {
        const time = iceTimeById.get(player.playerId);

        if (
            !["C", "L", "R", "D"].includes(player.positionCode) ||
            player.positionCode !== time.positionCode ||
            !Number.isInteger(player.gamesPlayed) ||
            player.gamesPlayed <= 0 ||
            player.gamesPlayed !== time.gamesPlayed
        ) {
            throw new Error(
                `Position or games mismatch: ${player.playerId}, ${season}`
            );
        }

        const seconds = time.ppTimeOnIce;

        if (!Number.isFinite(seconds) || seconds < 0) {
            throw new Error(
                `Invalid PP ice time: ${player.playerId}, ${season}`
            );
        }

        const points = player.ppPoints;
        const minutes = seconds / 60;
        const eligible = minutes >= 75;

        // Preserve missing points rather than assuming zero.
        if (points == null && eligible) {
            throw new Error(
                `Missing PP points for eligible player: ${player.playerId}, ${season}`
            );
        }

        if (
            points != null &&
            (!Number.isInteger(points) || points < 0)
        ) {
            throw new Error(
                `Invalid PP points: ${player.playerId}, ${season}`
            );
        }

        if (seconds === 0 && points > 0) {
            throw new Error(
                `PP points recorded without PP time: ${player.playerId}, ${season}`
            );
        }

        const secondsPerGame = seconds / player.gamesPlayed;
        const displaySeconds = Math.round(secondsPerGame);

        return {
            season,
            playerId: player.playerId,
            player: player.skaterFullName,
            position: player.positionCode,
            gamesPlayed: player.gamesPlayed,
            powerPlayPoints: points,
            powerPlayMinutes: minutes,
            powerPlaySecondsPerGame: secondsPerGame,
            powerPlayTimePerGame:
                `${Math.floor(displaySeconds / 60)}:` +
                `${displaySeconds % 60}`.padStart(2, "0"),
            powerPlayPointsPerGame:
                points == null ? null : points / player.gamesPlayed,
            sampleStatus:
                seconds === 0
                    ? "No PP opportunity"
                    : eligible
                        ? "Eligible"
                        : "Limited PP opportunity",
            dataStatus:
                points == null ? "PP points unavailable" : "Complete"
        };
    });
}

async function main() {
    const rows = [];
    const sources = [];

    for (const season of SEASONS) {
        const summary = await fetchReport("summary", season);
        const iceTime = await fetchReport("timeonice", season);

        const reference = buildPowerPlayReference(
            summary,
            iceTime,
            season
        );

        rows.push(...reference);

        sources.push({
            season,
            summaryRows: summary.length,
            iceTimeRows: iceTime.length
        });

        const eligibleCount = reference.filter(
            (row) => row.sampleStatus === "Eligible"
        ).length;

        console.log(
            `${season}: ${reference.length} matched; ` +
            `${eligibleCount} PP eligible.`
        );
    }

    rows.sort(
        (a, b) =>
            a.season - b.season ||
            a.position.localeCompare(b.position) ||
            a.playerId - b.playerId
    );

    const baselines = calculateBaselines(rows, PP_METRICS);
    const directory = path.resolve("data/league-reference");

    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "powerplay-skaters.csv"),
        stringify(rows, { header: true })
    );

    atomicWrite(
        path.join(directory, "powerplay-baselines.csv"),
        stringify(baselines, { header: true })
    );

    atomicWrite(
        path.join(directory, "powerplay-metadata.json"),
        JSON.stringify({
            collectedAt: new Date().toISOString(),
            seasons: SEASONS,
            gameTypeId: 2,
            minimumPowerPlayMinutes: 75,
            reports: ["summary", "timeonice"],
            sources,
            metrics: PP_METRICS,
            standardDeviation: "Population",
            weighting: "Each eligible skater equally weighted",
            note:
                "Individual PP points divided by all games played. " +
                "Baselines include only players with at least 75 PP minutes. " +
                "Descriptive comparisons only; no PP bonus or weight assigned."
        }, null, 2) + "\n"
    );

    console.table(
        baselines.map((row) => ({
            season: row.season,
            position: row.position,
            players: row.eligiblePlayers,
            pointsPerGameAverage: row.mean.toFixed(3),
            standardDeviation:
                row.populationStandardDeviation.toFixed(3)
        }))
    );

    console.log(
        `Saved ${rows.length} records and ${baselines.length} PP baselines.`
    );
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});