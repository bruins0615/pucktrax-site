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

const TEAM_METRICS = [
    "teamEstimatedOnIceUnblockedAttemptsPer60_5v5",
    "teamOnIceGoalsForPer60EvenStrength"
];

function buildTeamReference(shooting, goals, iceTime, season) {
    const shootingById = indexReport(shooting, season);
    const goalsById = indexReport(goals, season);
    const iceTimeById = indexReport(iceTime, season);

    const sameCoverage = [goalsById, iceTimeById].every(
        (report) =>
            report.size === shootingById.size &&
            [...shootingById.keys()].every((id) => report.has(id))
    );

    if (!sameCoverage) {
        throw new Error(`Report coverage differs for ${season}`);
    }

    return [...shootingById.values()].map((shots) => {
        const goalStats = goalsById.get(shots.playerId);
        const timeStats = iceTimeById.get(shots.playerId);

        if (
            !["C", "L", "R", "D"].includes(shots.positionCode) ||
            !Number.isInteger(shots.gamesPlayed) ||
            shots.gamesPlayed <= 0 ||
            goalStats.gamesPlayed !== shots.gamesPlayed ||
            timeStats.gamesPlayed !== shots.gamesPlayed ||
            goalStats.positionCode !== shots.positionCode ||
            timeStats.positionCode !== shots.positionCode
        ) {
            throw new Error(
                `Position or games mismatch: ${shots.playerId}, ${season}`
            );
        }

        const seconds5v5 =
            shots.timeOnIcePerGame5v5 * shots.gamesPlayed;

        const secondsEV = timeStats.evTimeOnIce;

        if (
            !Number.isFinite(shots.timeOnIcePerGame5v5) ||
            shots.timeOnIcePerGame5v5 < 0 ||
            !Number.isFinite(secondsEV) ||
            secondsEV < 0
        ) {
            throw new Error(
                `Invalid ice time: ${shots.playerId}, ${season}`
            );
        }

        const minutes5v5 = seconds5v5 / 60;
        const eligible = minutes5v5 >= MODEL_CONFIG.minimumMinutes5v5;

        const shSeconds = timeStats.shTimeOnIce;
        const shGoals = goalStats.shortHandedGoalsFor;

        if (!Number.isFinite(shSeconds) || shSeconds < 0) {
            throw new Error(
                `Invalid SH ice time: ${shots.playerId}, ${season}`
            );
        }

        const shMinutes = shSeconds / 60;
        const shEligible =
            shMinutes >= MODEL_CONFIG.minimumShortHandedMinutes;

        if (shGoals == null && shEligible) {
            throw new Error(
                `Missing team SH goals for eligible player: ${shots.playerId}, ${season}`
            );
        }

        if (
            shGoals != null &&
            (!Number.isInteger(shGoals) || shGoals < 0)
        ) {
            throw new Error(
                `Invalid team SH goals: ${shots.playerId}, ${season}`
            );
        }

        if (shSeconds === 0 && shGoals > 0) {
            throw new Error(
                `Team SH goals recorded without SH time: ${shots.playerId}, ${season}`
            );
        }

        const shDisplaySeconds = Math.round(
            shSeconds / shots.gamesPlayed
        );

        const rates = [
            [shots.usatFor, seconds5v5],
            [goalStats.evenStrengthGoalsFor, secondsEV]
        ].map(([count, seconds]) => {
            if (count == null || seconds === 0) {
                if (eligible) {
                    throw new Error(
                        `Missing eligible-player data: ${shots.playerId}, ${season}`
                    );
                }

                return null;
            }

            if (!Number.isInteger(count) || count < 0) {
                throw new Error(
                    `Invalid event count: ${shots.playerId}, ${season}`
                );
            }

            return count * 3600 / seconds;
        });

        return {
            season,
            playerId: shots.playerId,
            player: shots.skaterFullName,
            position: shots.positionCode,
            gamesPlayed: shots.gamesPlayed,
            estimatedMinutes5v5: minutes5v5,
            evenStrengthMinutes: secondsEV / 60,
            sampleStatus: eligible ? "Eligible" : "Limited sample",
            teamOnIceUnblockedAttempts5v5: shots.usatFor,
            teamOnIceGoalsForEvenStrength:
                goalStats.evenStrengthGoalsFor,
            [TEAM_METRICS[0]]: rates[0],
            [TEAM_METRICS[1]]: rates[1],
            shortHandedMinutes: shMinutes,
            shortHandedSecondsPerGame:
                shSeconds / shots.gamesPlayed,
            shortHandedTimePerGame:
                `${Math.floor(shDisplaySeconds / 60)}:` +
                String(shDisplaySeconds % 60).padStart(2, "0"),
            teamOnIceShortHandedGoals: shGoals,
            teamOnIceShortHandedGoalsPerGame:
                shGoals == null ? null : shGoals / shots.gamesPlayed,
            shortHandedSampleStatus:
                shSeconds === 0
                    ? "No SH opportunity"
                    : shEligible
                        ? "Eligible"
                        : "Limited SH opportunity",
            shortHandedDataStatus:
                shGoals == null ? "Team SH goals unavailable" : "Complete"
        };
    });
}

async function main() {
    const rows = [];
    const sources = [];

    for (const season of SEASONS) {
        const shooting = await fetchReport("summaryshooting", season);
        const goals = await fetchReport("goalsForAgainst", season);
        const iceTime = await fetchReport("timeonice", season);

        const reference = buildTeamReference(
            shooting,
            goals,
            iceTime,
            season
        );

        rows.push(...reference);

        sources.push({
            season,
            shootingRows: shooting.length,
            goalsRows: goals.length,
            iceTimeRows: iceTime.length
        });

        const eligibleCount = reference.filter(
            (row) => row.sampleStatus === "Eligible"
        ).length;

        console.log(
            `${season}: ${reference.length} matched; ${eligibleCount} eligible.`
        );
    }

    rows.sort(
        (a, b) =>
            a.season - b.season ||
            a.position.localeCompare(b.position) ||
            a.playerId - b.playerId
    );

    const baselines = calculateBaselines(rows, TEAM_METRICS);

    const directory = path.resolve("data/league-reference");

    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "team-context-skaters.csv"),
        stringify(rows, { header: true })
    );

    atomicWrite(
        path.join(directory, "team-context-baselines.csv"),
        stringify(baselines, { header: true })
    );

    atomicWrite(
        path.join(directory, "team-context-metadata.json"),
        JSON.stringify({
            collectedAt: new Date().toISOString(),
            seasons: SEASONS,
            gameTypeId: 2,
            minimumMinutes5v5: MODEL_CONFIG.minimumMinutes5v5,
            minimumShortHandedMinutes:
                MODEL_CONFIG.minimumShortHandedMinutes,
            shortHandedPolicy:
                "Team SH goals divided by all recorded games played. " +
                "SH sample labels use the SH minute cutoff independently " +
                "of five-on-five eligibility. Recorded SH production is " +
                "retained below the cutoff. No SH baseline or rating " +
                "contribution is calculated.",
            reports: ["summaryshooting", "goalsForAgainst", "timeonice"],
            sources,
            metrics: TEAM_METRICS,
            standardDeviation: "Population",
            weighting: "Each eligible skater equally weighted",
            note:
                "Team on-ice context only. Unadjusted for teammates, opponents " +
                "and deployment. Five-on-five time reconstructed from the " +
                "summaryshooting per-game average."
        }, null, 2) + "\n"
    );

    console.table(
        baselines.map((row) => ({
            season: row.season,
            position: row.position,
            metric: row.metric,
            players: row.eligiblePlayers,
            average: row.mean.toFixed(3)
        }))
    );

    console.log(
        `Saved ${rows.length} records and ${baselines.length} team baselines.`
    );
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    buildTeamReference,
    TEAM_METRICS
};