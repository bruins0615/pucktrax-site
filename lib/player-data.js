import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

function readRatings(filename) {
    const filePath = path.join(
        process.cwd(),
        "data",
        "offensive-ratings",
        filename
    );

    return parse(fs.readFileSync(filePath, "utf8"), {
        columns: true,
        skip_empty_lines: true
    });
}

function readCoreStats(playerId, season) {
    const filePath = path.join(
        process.cwd(),
        "data",
        "skater-performance.csv"
    );

    const rows = parse(fs.readFileSync(filePath, "utf8"), {
        columns: true,
        skip_empty_lines: true
    });

    return rows.find(
        (row) =>
            row.playerId === playerId &&
            row.season === season
    ) ?? null;
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
        coreStats,
        fiveOnFive,
        teamContext,
        powerPlay
    };
}