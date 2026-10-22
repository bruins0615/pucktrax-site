import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

function readRatings(filename, directory = "offensive-ratings") {
    const filePath = path.join(
        process.cwd(),
        "data",
        directory,
        filename
    );

    return parse(fs.readFileSync(filePath, "utf8"), {
        columns: true,
        skip_empty_lines: true
    });
}

function readCoreStats(playerId, season) {
    function readCsv(filePath) {
        return parse(fs.readFileSync(filePath, "utf8"), {
            columns: true,
            skip_empty_lines: true
        });
    }

    const matchesPlayerSeason = (row) =>
        row.playerId === playerId &&
        row.season === season;

    const detailed = readCsv(
        path.join(
            process.cwd(),
            "data",
            "skater-performance.csv"
        )
    ).find(matchesPlayerSeason);

    const core = readCsv(
        path.join(
            process.cwd(),
            "data",
            "league-reference",
            "core-skaters.csv"
        )
    ).find(matchesPlayerSeason);

    if (!core && !detailed) {
        return null;
    }

    return {
        ...(detailed ?? {}),
        ...(core ?? {})
    };
}

function readFiveOnFive(playerId, season) {
    const directory = path.join(
        process.cwd(),
        "data",
        "league-reference"
    );

    function readCsv(filename) {
        return parse(
            fs.readFileSync(path.join(directory, filename), "utf8"),
            {
                columns: true,
                skip_empty_lines: true
            }
        );
    }

    const player = readCsv("skaters.csv").find(
        (row) =>
            row.playerId === playerId &&
            row.season === season
    );

    if (!player) {
        return null;
    }

    const baselines = readCsv("baselines.csv").filter(
        (row) =>
            row.season === season &&
            row.position === player.position
    );

    return {
        player,
        baselines
    };
}

function readTeamContext(playerId, season) {
    const directory = path.join(
        process.cwd(),
        "data",
        "league-reference"
    );

    function readCsv(filename) {
        return parse(
            fs.readFileSync(path.join(directory, filename), "utf8"),
            {
                columns: true,
                skip_empty_lines: true
            }
        );
    }

    const player = readCsv("team-context-skaters.csv").find(
        (row) =>
            row.playerId === playerId &&
            row.season === season
    );

    if (!player) {
        return null;
    }

    const baselines = readCsv(
        "team-context-baselines.csv"
    ).filter(
        (row) =>
            row.season === season &&
            row.position === player.position
    );

    return {
        player,
        baselines
    };
}

function readPowerPlay(playerId, season) {
    const directory = path.join(
        process.cwd(),
        "data",
        "league-reference"
    );

    function readCsv(filename) {
        return parse(
            fs.readFileSync(path.join(directory, filename), "utf8"),
            {
                columns: true,
                skip_empty_lines: true
            }
        );
    }

    const player = readCsv("powerplay-skaters.csv").find(
        (row) =>
            row.playerId === playerId &&
            row.season === season
    );

    if (!player) {
        return null;
    }

    const teamBaseline = readCsv(
        "powerplay-baselines.csv"
    ).find(
        (row) =>
            row.season === season &&
            row.position === player.position &&
            row.metric === "teamOnIcePowerPlayGoalsPerGame"
    );

    return {
        player,
        teamBaseline: teamBaseline ?? null
    };
}

export function getPlayerRatings(playerId) {
    const id = String(playerId);

    const historical = readRatings(
        "historical-offensive-ratings.csv"
    ).find((row) => row.playerId === id);

    if (!historical) {
        return null;
    }

    const seasons = readRatings(
        "season-offensive-ratings.csv"
    )
        .filter((row) => row.playerId === id)
        .sort((a, b) => b.season.localeCompare(a.season));

    const defensiveHistorical = readRatings(
        "historical-defensive-ratings.csv",
        "defensive-ratings"
    ).find((row) => row.playerId === id) ?? null;

    const defensiveSeasons = readRatings(
        "season-defensive-indices.csv",
        "defensive-ratings"
    )
        .filter((row) => row.playerId === id)
        .sort((a, b) => b.season.localeCompare(a.season));

    const latestSeason = seasons[0]?.season;

    const coreStats = latestSeason
        ? readCoreStats(id, latestSeason)
        : null;

    const fiveOnFive = latestSeason
        ? readFiveOnFive(id, latestSeason)
        : null;

    const teamContext = latestSeason
        ? readTeamContext(id, latestSeason)
        : null;

    const powerPlay = latestSeason
        ? readPowerPlay(id, latestSeason)
        : null;

    return {
        historical,
        seasons,
        defensiveHistorical,
        defensiveSeasons,
        coreStats,
        fiveOnFive,
        teamContext,
        powerPlay
    };
}

export function getPlayerDirectory() {
    const coreRows = parse(
        fs.readFileSync(
            path.join(
                process.cwd(),
                "data",
                "league-reference",
                "core-skaters.csv"
            ),
            "utf8"
        ),
        {
            columns: true,
            skip_empty_lines: true
        }
    );

    const teamsByPlayer = new Map();

    for (const row of coreRows) {
        if (!teamsByPlayer.has(row.playerId)) {
            teamsByPlayer.set(row.playerId, {});
        }

        const teamsBySeason = teamsByPlayer.get(row.playerId);

        teamsBySeason[row.season] = [
            ...new Set(
                row.teams
                    .split(",")
                    .map((team) => team.trim())
                    .filter(Boolean)
            )
        ];
    }

    const defenseByPlayer = new Map(
        readRatings(
            "historical-defensive-ratings.csv",
            "defensive-ratings"
        ).map((row) => [row.playerId, row])
    );

    return readRatings(
        "historical-offensive-ratings.csv"
    )
        .map((row) => ({
            playerId: row.playerId,
            player: row.player,
            position: row.position,
            offenseRating: row.offenseRating,
            defenseRating:
                defenseByPlayer.get(row.playerId)?.defenseRating ?? "",
            eligibleSeasons: row.eligibleSeasons,
            defensiveEligibleSeasons:
                defenseByPlayer.get(row.playerId)?.eligibleSeasons ?? "0",
            windowStart: row.windowStart,
            windowEnd: row.windowEnd,
            teamsBySeason: teamsByPlayer.get(row.playerId) ?? {}
        }))
        .sort((a, b) =>
            a.player.localeCompare(b.player, "en", {
                sensitivity: "base"
            })
        );
}