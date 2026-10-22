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

const RULES = MODEL_CONFIG.faceoffEligibility;

const GROUPS = [
    {
        name: "overall",
        attempts: "totalFaceoffs",
        wins: "totalFaceoffWins",
        losses: "totalFaceoffLosses",
        metric: "overallFaceoffWinPct"
    },
    {
        name: "defensiveZone",
        attempts: "defensiveZoneFaceoffs",
        wins: "defensiveZoneFaceoffWins",
        losses: "defensiveZoneFaceoffLosses",
        metric: "defensiveZoneFaceoffWinPct"
    },
    {
        name: "offensiveZone",
        attempts: "offensiveZoneFaceoffs",
        wins: "offensiveZoneFaceoffWins",
        losses: "offensiveZoneFaceoffLosses",
        metric: "offensiveZoneFaceoffWinPct"
    },
    {
        name: "neutralZone",
        attempts: "neutralZoneFaceoffs",
        wins: "neutralZoneFaceoffWins",
        losses: "neutralZoneFaceoffLosses",
        metric: "neutralZoneFaceoffWinPct"
    },
    {
        name: "evenStrength",
        attempts: "evFaceoffs",
        wins: "evFaceoffsWon",
        losses: "evFaceoffsLost",
        metric: "evenStrengthFaceoffWinPct"
    },
    {
        name: "powerPlay",
        attempts: "ppFaceoffs",
        wins: "ppFaceoffsWon",
        losses: "ppFaceoffsLost",
        metric: "powerPlayFaceoffWinPct"
    },
    {
        name: "shortHanded",
        attempts: "shFaceoffs",
        wins: "shFaceoffsWon",
        losses: "shFaceoffsLost",
        metric: "shortHandedFaceoffWinPct"
    }
];

const BASELINE_GROUPS = GROUPS.filter(
    (group) => group.name !== "evenStrength"
);

function specialTeamsStatus(overallEligible, minutes, draws) {
    if (!overallEligible) {
        return "Below overall minimum";
    }

    if (
        minutes >= RULES.minimumSpecialTeamsMinutes &&
        draws >= RULES.minimumSpecialTeamsDraws
    ) {
        return "Regular usage";
    }

    if (draws >= RULES.minimumSpecialistDraws) {
        return "Draw-volume exception";
    }

    return "Below situational minimum";
}

function buildFaceoffReference(faceoffs, iceTime, season) {
    const faceoffsById = indexReport(faceoffs, season);
    const iceTimeById = indexReport(iceTime, season);

    if (
        faceoffsById.size !== iceTimeById.size ||
        [...faceoffsById.keys()].some((id) => !iceTimeById.has(id))
    ) {
        throw new Error(`Faceoff report coverage differs for ${season}`);
    }

    return [...faceoffsById.values()].map((source) => {
        const time = iceTimeById.get(source.playerId);
        const identity = `${source.playerId}-${season}`;

        if (
            !["C", "L", "R", "D"].includes(source.positionCode) ||
            !Number.isInteger(source.gamesPlayed) ||
            source.gamesPlayed <= 0 ||
            time.gamesPlayed !== source.gamesPlayed ||
            time.positionCode !== source.positionCode
        ) {
            throw new Error(`Faceoff identity mismatch: ${identity}`);
        }

        const row = {
            season,
            playerId: source.playerId,
            player: source.skaterFullName,
            position: source.positionCode,
            gamesPlayed: source.gamesPlayed
        };

        for (const group of GROUPS) {
            for (const field of [
                group.attempts,
                group.wins,
                group.losses
            ]) {
                const value = source[field];

                if (!Number.isInteger(value) || value < 0) {
                    throw new Error(
                        `Invalid faceoff count: ${field}, ${identity}`
                    );
                }

                row[field] = value;
            }

            if (
                row[group.wins] + row[group.losses] !==
                row[group.attempts]
            ) {
                throw new Error(
                    `Faceoff wins/losses mismatch: ${group.name}, ${identity}`
                );
            }

            row[group.metric] = row[group.attempts] === 0
                ? null
                : row[group.wins] / row[group.attempts];
        }

        for (const fields of [
            [
                "defensiveZoneFaceoffs",
                "offensiveZoneFaceoffs",
                "neutralZoneFaceoffs"
            ],
            ["evFaceoffs", "ppFaceoffs", "shFaceoffs"]
        ]) {
            const total = fields.reduce((sum, field) => sum + row[field], 0);

            if (total !== row.totalFaceoffs) {
                throw new Error(`Faceoff split totals mismatch: ${identity}`);
            }
        }

        for (const [field, output] of [
            ["ppTimeOnIce", "powerPlayMinutes"],
            ["shTimeOnIce", "shortHandedMinutes"]
        ]) {
            if (!Number.isFinite(time[field]) || time[field] < 0) {
                throw new Error(
                    `Invalid special-teams ice time: ${field}, ${identity}`
                );
            }

            row[output] = time[field] / 60;
        }

        row.faceoffsPerGame = row.totalFaceoffs / row.gamesPlayed;

        const overallEligible =
            row.totalFaceoffs >= RULES.minimumOverallDraws;

        row.overallSampleStatus = row.totalFaceoffs === 0
            ? "Not applicable"
            : overallEligible
                ? "Eligible"
                : "Limited sample";

        for (const name of [
            "defensiveZone",
            "offensiveZone",
            "neutralZone"
        ]) {
            row[`${name}SampleStatus`] =
                overallEligible &&
                    row[`${name}Faceoffs`] >= RULES.minimumZoneDraws
                    ? "Eligible"
                    : "Limited sample";
        }

        row.combinedSampleStatus = !overallEligible
            ? row.overallSampleStatus
            : [
                "defensiveZone",
                "offensiveZone",
                "neutralZone"
            ].every((name) => row[`${name}SampleStatus`] === "Eligible")
                ? "Eligible"
                : "Incomplete zone sample";

        row.powerPlaySampleStatus = specialTeamsStatus(
            overallEligible,
            row.powerPlayMinutes,
            row.ppFaceoffs
        );

        row.shortHandedSampleStatus = specialTeamsStatus(
            overallEligible,
            row.shortHandedMinutes,
            row.shFaceoffs
        );

        return row;
    });
}

function buildFaceoffBaselines(rows) {
    return BASELINE_GROUPS.flatMap((group) => {
        const qualifying = rows
            .filter((row) => {
                const status = row[`${group.name}SampleStatus`];

                return status === "Eligible" ||
                    status === "Regular usage" ||
                    status === "Draw-volume exception";
            })
            .map((row) => ({
                ...row,
                position: "All",
                sampleStatus: "Eligible"
            }));

        return calculateBaselines(qualifying, [group.metric]);
    });
}

async function main() {
    const rows = [];
    const sources = [];

    for (const season of MODEL_CONFIG.historicalSeasons) {
        const faceoffs = await fetchReport("faceoffwins", season);
        const iceTime = await fetchReport("timeonice", season);
        const reference = buildFaceoffReference(faceoffs, iceTime, season);

        rows.push(...reference);
        sources.push({
            season,
            faceoffRows: faceoffs.length,
            iceTimeRows: iceTime.length
        });

        console.log(
            `${season}: ${reference.length} matched; ` +
            `${reference.filter((r) => r.overallSampleStatus === "Eligible").length} overall eligible; ` +
            `${reference.filter((r) => r.combinedSampleStatus === "Eligible").length} complete zone profiles.`
        );
    }

    rows.sort(
        (a, b) =>
            a.season - b.season ||
            a.playerId - b.playerId
    );

    const baselines = buildFaceoffBaselines(rows);
    const directory = path.resolve("data/league-reference");

    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "faceoff-skaters.csv"),
        stringify(rows, { header: true })
    );

    atomicWrite(
        path.join(directory, "faceoff-baselines.csv"),
        stringify(baselines, { header: true })
    );

    atomicWrite(
        path.join(directory, "faceoff-metadata.json"),
        JSON.stringify({
            collectedAt: new Date().toISOString(),
            seasons: MODEL_CONFIG.historicalSeasons,
            gameTypeId: 2,
            reports: ["faceoffwins", "timeonice"],
            sources,
            eligibility: RULES,
            metrics: BASELINE_GROUPS.map((group) => group.metric),
            percentageStorage:
                "Fractions from 0 to 1. Zero attempts yields null.",
            baselineGrouping:
                "Same season, all qualifying positions pooled as All. " +
                "Original player positions remain unchanged.",
            baselineEligibility:
                "Each metric uses its own qualifying pool. Zone baselines " +
                "do not require a complete three-zone profile.",
            weighting: "Each qualifying player equally weighted",
            standardDeviation: "Population",
            note:
                "Reference statistics only; no faceoff indices or grades. " +
                "Zone and strength splits are separate, not intersections. " +
                "Even-strength results are retained as context without a baseline."
        }, null, 2) + "\n"
    );

    console.table(
        baselines.map((row) => ({
            season: row.season,
            metric: row.metric,
            players: row.eligiblePlayers,
            averagePct: (row.mean * 100).toFixed(1),
            standardDeviation:
                (row.populationStandardDeviation * 100).toFixed(2)
        }))
    );

    console.log(
        `Saved ${rows.length} records and ${baselines.length} faceoff baselines.`
    );
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    buildFaceoffReference,
    buildFaceoffBaselines,
    specialTeamsStatus
};