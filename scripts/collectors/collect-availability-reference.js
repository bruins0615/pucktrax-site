const MODEL_CONFIG = require("../../config/model-config");

const fs = require("node:fs");
const path = require("node:path");
const { stringify } = require("csv-stringify/sync");

const {
    fetchReport,
    indexReport,
    atomicWrite
} = require("./collect-league-reference");

function buildParticipationRecord({
    playerId,
    player,
    season,
    position,
    careerGamesEnteringSeason,
    gamesPlayed,
    coverageStatus,
    verificationSource = ""
}) {
    const identity = `${playerId}-${season}`;

    if (
        !Number.isInteger(careerGamesEnteringSeason) ||
        careerGamesEnteringSeason < 0
    ) {
        throw new Error(`Invalid entering career games: ${identity}`);
    }

    const validCoverage = [
        "Recorded appearances",
        "Verified zero",
        "Unresolved",
        "Outside NHL involvement"
    ];

    if (!validCoverage.includes(coverageStatus)) {
        throw new Error(`Invalid coverage status: ${identity}`);
    }

    const outsideNhl =
        coverageStatus === "Outside NHL involvement";

    if (coverageStatus === "Unresolved" || outsideNhl) {
        if (gamesPlayed !== null) {
            throw new Error(
                `Unresolved or excluded games must remain null: ${identity}`
            );
        }

        if (
            outsideNhl &&
            (
                typeof verificationSource !== "string" ||
                !verificationSource.trim()
            )
        ) {
            throw new Error(
                `Excluded season requires a source: ${identity}`
            );
        }
    } else {
        if (!Number.isInteger(gamesPlayed) || gamesPlayed < 0) {
            throw new Error(`Invalid games played: ${identity}`);
        }

        if (
            coverageStatus === "Recorded appearances" &&
            gamesPlayed === 0
        ) {
            throw new Error(
                `Zero games require verification: ${identity}`
            );
        }

        if (
            coverageStatus === "Verified zero" &&
            (
                gamesPlayed !== 0 ||
                typeof verificationSource !== "string" ||
                !verificationSource.trim()
            )
        ) {
            throw new Error(
                `Verified zero requires zero games and a source: ${identity}`
            );
        }
    }

    const veteranEligible =
        careerGamesEnteringSeason >=
        MODEL_CONFIG.minimumCareerGamesForAvailability;

    const participationStatus = outsideNhl
        ? "Not applicable"
        : !veteranEligible
            ? "Below veteran minimum"
            : coverageStatus === "Unresolved"
                ? "Unresolved"
                : "Eligible";

    return {
        playerId,
        player,
        season,
        position,
        careerGamesEnteringSeason,
        gamesPlayed,
        participationStatus,
        coverageStatus,
        verificationSource
    };
}

async function fetchEnteringCareerGames(season) {
    const startYear = Math.floor(season / 10000);
    const previousSeason = (startYear - 1) * 10000 + startYear;

    const url = new URL(
        "https://api.nhle.com/stats/rest/en/skater/summary"
    );

    url.search = new URLSearchParams({
        isAggregate: "true",
        isGame: "false",
        limit: "-1",
        cayenneExp:
            `seasonId>=19171918 and ` +
            `seasonId<=${previousSeason} and gameTypeId=2`
    });

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const body = await response.json();

            if (
                !Array.isArray(body.data) ||
                body.data.length === 0 ||
                body.total !== body.data.length
            ) {
                throw new Error("Incomplete career-history report");
            }

            const careerGamesById = new Map();

            for (const row of body.data) {
                if (
                    !Number.isInteger(row.playerId) ||
                    !Number.isInteger(row.gamesPlayed) ||
                    row.gamesPlayed <= 0 ||
                    careerGamesById.has(row.playerId)
                ) {
                    throw new Error(
                        `Invalid or duplicate career record: ${row.playerId}`
                    );
                }

                careerGamesById.set(row.playerId, row.gamesPlayed);
            }

            return {
                careerGamesById,
                sourceUrl: url.toString(),
                throughSeason: previousSeason
            };
        } catch (error) {
            if (attempt === 5) {
                throw new Error(
                    `Career history entering ${season}: ${error.message}`
                );
            }

            console.log(
                `Career history entering ${season}, attempt ` +
                `${attempt}: ${error.message}. Retrying in 10 seconds.`
            );

            await new Promise((resolve) => setTimeout(resolve, 10000));
        }
    }
}

async function main() {
    const seasons = MODEL_CONFIG.historicalSeasons;
    const exceptionsFile = path.resolve(
        "config/availability-exceptions.json"
    );
    const exceptions = JSON.parse(
        fs.readFileSync(exceptionsFile, "utf8")
    );

    if (!Array.isArray(exceptions)) {
        throw new Error("Availability exceptions must be an array");
    }

    const exceptionsByKey = new Map();
    const candidates = new Map();

    for (const entry of exceptions) {
        const key = `${entry.playerId}-${entry.season}`;

        if (
            !Number.isInteger(entry.playerId) ||
            !seasons.includes(entry.season) ||
            typeof entry.player !== "string" ||
            !entry.player.trim() ||
            !["C", "L", "R", "D"].includes(entry.position) ||
            ![
                "Verified zero",
                "Unresolved",
                "Outside NHL involvement"
            ].includes(entry.coverageStatus) ||
            typeof entry.verificationSource !== "string" ||
            !entry.verificationSource.trim() ||
            typeof entry.note !== "string" ||
            !entry.note.trim() ||
            exceptionsByKey.has(key)
        ) {
            throw new Error(`Invalid availability exception: ${key}`);
        }

        exceptionsByKey.set(key, entry);
        candidates.set(entry.playerId, {
            player: entry.player,
            position: entry.position
        });
    }

    const reportsBySeason = new Map();

    for (const season of seasons) {
        const report = await fetchReport("summary", season);
        const indexed = indexReport(report, season);

        for (const row of indexed.values()) {
            if (
                !Number.isInteger(row.gamesPlayed) ||
                row.gamesPlayed <= 0 ||
                !["C", "L", "R", "D"].includes(row.positionCode) ||
                typeof row.skaterFullName !== "string" ||
                !row.skaterFullName.trim()
            ) {
                throw new Error(
                    `Invalid season appearances: ${row.playerId}-${season}`
                );
            }

            candidates.set(row.playerId, {
                player: row.skaterFullName,
                position: row.positionCode
            });
        }

        reportsBySeason.set(season, indexed);
    }

    const rows = [];
    const sources = [];

    for (const season of seasons) {
        const report = reportsBySeason.get(season);
        const career = await fetchEnteringCareerGames(season);
        const seasonRows = [];

        for (const [playerId, candidate] of candidates) {
            const appearance = report.get(playerId);
            const key = `${playerId}-${season}`;
            const exception = exceptionsByKey.get(key);

            if (appearance && exception) {
                throw new Error(
                    `Exception conflicts with recorded appearances: ${key}`
                );
            }

            const careerGamesEnteringSeason =
                career.careerGamesById.get(playerId) ?? 0;

            // Preserve all recorded seasons. For absent seasons, retain
            // veteran candidates or explicitly documented exceptions.
            if (
                !appearance &&
                !exception &&
                careerGamesEnteringSeason <
                MODEL_CONFIG.minimumCareerGamesForAvailability
            ) {
                continue;
            }

            const coverageStatus = appearance
                ? "Recorded appearances"
                : exception?.coverageStatus ?? "Unresolved";

            const record = buildParticipationRecord({
                playerId,
                player:
                    appearance?.skaterFullName ??
                    exception?.player ??
                    candidate.player,
                season,
                position:
                    appearance?.positionCode ??
                    exception?.position ??
                    candidate.position,
                careerGamesEnteringSeason,
                gamesPlayed: appearance
                    ? appearance.gamesPlayed
                    : coverageStatus === "Verified zero"
                        ? 0
                        : null,
                coverageStatus,
                verificationSource: appearance
                    ? "NHL summary report"
                    : exception?.verificationSource ?? ""
            });

            seasonRows.push({
                ...record,
                coverageNote: appearance
                    ? ""
                    : exception?.note ??
                    "No season row; NHL involvement requires review.",
                positionSource: appearance
                    ? "Season summary"
                    : exception
                        ? "Documented exception"
                        : "Latest recorded historical position"
            });
        }

        rows.push(...seasonRows);

        sources.push({
            season,
            appearanceRows: report.size,
            careerPlayers: career.careerGamesById.size,
            careerThroughSeason: career.throughSeason,
            careerSourceUrl: career.sourceUrl
        });

        console.log(
            `${season}: ${report.size} recorded; ` +
            `${seasonRows.filter(
                (row) => row.participationStatus === "Eligible"
            ).length} veteran eligible; ` +
            `${seasonRows.filter(
                (row) => row.coverageStatus === "Unresolved"
            ).length} unresolved.`
        );
    }

    rows.sort(
        (a, b) => a.season - b.season || a.playerId - b.playerId
    );

    const directory = path.resolve("data/league-reference");
    fs.mkdirSync(directory, { recursive: true });

    atomicWrite(
        path.join(directory, "availability-skaters.csv"),
        stringify(rows, { header: true })
    );

    atomicWrite(
        path.join(directory, "availability-metadata.json"),
        JSON.stringify({
            collectedAt: new Date().toISOString(),
            modelVersion: MODEL_CONFIG.availabilityModelVersion,
            seasons,
            gameTypeId: 2,
            minimumCareerGames:
                MODEL_CONFIG.minimumCareerGamesForAvailability,
            fullCreditGames: MODEL_CONFIG.availabilityFullCreditGames,
            sources,
            exceptions,
            candidateCoverage:
                "Players appearing in the historical window, plus " +
                "explicit exceptions. This is not a complete inventory " +
                "of veterans absent throughout the entire window.",
            missingDataPolicy:
                "Absent veteran seasons remain unresolved unless " +
                "documented. Retirement and overseas seasons are not " +
                "automatically assigned zero.",
            scoring:
                "Reference collection only; grades are calculated separately."
        }, null, 2) + "\n"
    );

    console.log(`Saved ${rows.length} availability reference records.`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    buildParticipationRecord,
    fetchEnteringCareerGames
};