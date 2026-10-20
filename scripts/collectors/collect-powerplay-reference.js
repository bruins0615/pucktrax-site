const fs = require("node:fs");
const path = require("node:path");
const { stringify } = require("csv-stringify/sync");

const {
    fetchReport,
    indexReport,
    atomicWrite,
    calculateBaselines
} = require("./collect-league-reference");

const MODEL_CONFIG = require("../../config/model-config");

const SEASONS = MODEL_CONFIG.historicalSeasons;

const PP_METRICS = [
    "powerPlayPointsPerGame",
    "teamOnIcePowerPlayGoalsPerGame"
];

function buildCoreReference(summary, season) {
    const players = indexReport(summary, season);

    return [...players.values()].map((player) => {
        const counts = [
            player.goals,
            player.assists,
            player.points
        ];

        if (
            !["C", "L", "R", "D"].includes(player.positionCode) ||
            !Number.isInteger(player.gamesPlayed) ||
            player.gamesPlayed <= 0 ||
            counts.some(
                (value) => !Number.isInteger(value) || value < 0
            ) ||
            !Number.isInteger(player.plusMinus) ||
            player.goals + player.assists !== player.points
        ) {
            throw new Error(
                `Invalid core statistics: ${player.playerId}, ${season}`
            );
        }

        return {
            season,
            playerId: player.playerId,
            player: player.skaterFullName,
            position: player.positionCode,
            teams: player.teamAbbrevs ?? "",
            gamesPlayed: player.gamesPlayed,
            goals: player.goals,
            assists: player.assists,
            points: player.points,
            plusMinus: player.plusMinus
        };
    });
}

function buildPowerPlayReference(summary, iceTime, season, goals) {
    const summaryById = indexReport(summary, season);
    const iceTimeById = indexReport(iceTime, season);
    const goalsById = indexReport(goals, season);

    const sameCoverage = [iceTimeById, goalsById].every(
        (report) =>
            report.size === summaryById.size &&
            [...summaryById.keys()].every((id) => report.has(id))
    );

    if (!sameCoverage) {
        throw new Error(`Report coverage differs for ${season}`);
    }

    return [...summaryById.values()].map((player) => {
        const time = iceTimeById.get(player.playerId);
        const goalStats = goalsById.get(player.playerId);

        if (
            !["C", "L", "R", "D"].includes(player.positionCode) ||
            player.positionCode !== time.positionCode ||
            player.positionCode !== goalStats.positionCode ||
            !Number.isInteger(player.gamesPlayed) ||
            player.gamesPlayed <= 0 ||
            player.gamesPlayed !== time.gamesPlayed ||
            player.gamesPlayed !== goalStats.gamesPlayed
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
        const eligible = minutes >= MODEL_CONFIG.minimumPowerPlayMinutes;
        const teamGoals = goalStats.powerPlayGoalFor;

        if (teamGoals == null && eligible) {
            throw new Error(
                `Missing team PP goals for eligible player: ${player.playerId}, ${season}`
            );
        }

        if (
            teamGoals != null &&
            (!Number.isInteger(teamGoals) || teamGoals < 0)
        ) {
            throw new Error(
                `Invalid team PP goals: ${player.playerId}, ${season}`
            );
        }

        if (seconds === 0 && teamGoals > 0) {
            throw new Error(
                `Team PP goals recorded without PP time: ${player.playerId}, ${season}`
            );
        }

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
            teamOnIcePowerPlayGoals: teamGoals,
            teamOnIcePowerPlayGoalsPerGame:
                teamGoals == null ? null : teamGoals / player.gamesPlayed,
            sampleStatus:
                seconds === 0
                    ? "No PP opportunity"
                    : eligible
                        ? "Eligible"
                        : "Limited PP opportunity",
            dataStatus:
                points == null || teamGoals == null
                    ? [
                        points == null ? "PP points unavailable" : null,
                        teamGoals == null ? "Team PP goals unavailable" : null
                    ].filter(Boolean).join("; ")
                    : "Complete"
        };
    });
}

async function main() {
    const rows = [];
    const coreRows = [];
    const sources = [];

    for (const season of SEASONS) {
        const summary = await fetchReport("summary", season);
        const iceTime = await fetchReport("timeonice", season);
        const goals = await fetchReport("goalsForAgainst", season);

        const reference = buildPowerPlayReference(
            summary,
            iceTime,
            season,
            goals
        );

        rows.push(...reference);
        coreRows.push(...buildCoreReference(summary, season));

        sources.push({
            season,
            summaryRows: summary.length,
            iceTimeRows: iceTime.length,
            goalsRows: goals.length
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

    coreRows.sort(
        (a, b) =>
            a.season - b.season ||
            a.playerId - b.playerId
    );

    atomicWrite(
        path.join(directory, "core-skaters.csv"),
        stringify(coreRows, { header: true })
    );

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
            minimumPowerPlayMinutes: MODEL_CONFIG.minimumPowerPlayMinutes,
            reports: ["summary", "timeonice", "goalsForAgainst"],
            sources,
            metrics: PP_METRICS,
            coreStatisticsOutput: "data/league-reference/core-skaters.csv",
            coreStatisticsPolicy:
                "All-situation regular-season totals from the summary report. " +
                "Team abbreviations describe season affiliations, not current roster membership.",
            standardDeviation: "Population",
            weighting: "Each eligible skater equally weighted",
            note:
                "Individual PP points/game and team on-ice PP goals/game " +
                "both use all recorded games played as the denominator. " +
                "Baselines include only players with at least " +
                `${MODEL_CONFIG.minimumPowerPlayMinutes} PP minutes. ` +
                "Team on-ice PP goals/game is descriptive context only " +
                "and does not contribute to the offensive rating."
        }, null, 2) + "\n"
    );

    console.table(
        baselines.map((row) => ({
            season: row.season,
            position: row.position,
            players: row.eligiblePlayers,
            metric: row.metric,
            averagePerGame: row.mean.toFixed(3),
            standardDeviation:
                row.populationStandardDeviation.toFixed(3)
        }))
    );

    console.log(
        `Saved ${rows.length} records and ${baselines.length} PP baselines.`
    );
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    buildPowerPlayReference,
    buildCoreReference,
    PP_METRICS
};