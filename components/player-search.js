"use client";

import Link from "next/link";
import { useId, useState } from "react";

const POSITIONS = {
    C: "Center",
    L: "Left wing",
    R: "Right wing",
    D: "Defenseman"
};

const RANGES = {
    "0–1.9": [0, 1.9],
    "2–3.9": [2, 3.9],
    "4–5.9": [4, 5.9],
    "6–7.9": [6, 7.9],
    "8–10": [8, 10]
};

const PAGE_SIZE = 40;

const CONTROL_STYLE =
    "w-full rounded-xl border border-slate-600 bg-[#101d32] px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30";

function normalize(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function ratingOf(player, field = "offenseRating") {
    const value = player[field];

    if (value == null || String(value).trim() === "") {
        return null;
    }

    const rating = Number(value);
    return Number.isFinite(rating) ? rating : null;
}

function SelectControl({ id, label, value, onChange, options }) {
    return (
        <div>
            <label
                htmlFor={id}
                className="mb-2 block text-sm font-medium text-slate-300"
            >
                {label}
            </label>
            <select
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={CONTROL_STYLE}
            >
                {options.map(([key, text]) => (
                    <option key={key} value={key}>
                        {text}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default function PlayerSearch({ players }) {
    const teamSeasons = [
        ...new Set(
            players.flatMap((player) =>
                Object.keys(player.teamsBySeason ?? {})
            )
        )
    ].sort((a, b) => b.localeCompare(a));
    const [query, setQuery] = useState("");
    const [position, setPosition] = useState("");
    const [ratingFilter, setRatingFilter] = useState("");
    const [defenseFilter, setDefenseFilter] = useState("");
    const [historyFilter, setHistoryFilter] = useState("");
    const [sort, setSort] = useState("name");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [teamSeason, setTeamSeason] = useState(
        teamSeasons[0] ?? ""
    );
    const [team, setTeam] = useState("");

    const teamOptions = [
        ...new Set(
            players.flatMap(
                (player) => player.teamsBySeason?.[teamSeason] ?? []
            )
        )
    ].sort();
    const id = useId();

    function update(setter, value) {
        setter(value);
        setVisibleCount(PAGE_SIZE);
    }

    function resetFilters() {
        setQuery("");
        setPosition("");
        setRatingFilter("");
        setDefenseFilter("");
        setHistoryFilter("");
        setSort("name");
        setVisibleCount(PAGE_SIZE);
        setTeam("");
        setTeamSeason(teamSeasons[0] ?? "");
    }

    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);

    const matches = players.filter((player) => {
        const name = normalize(player.player);
        const rating = ratingOf(player);
        const defense = ratingOf(player, "defenseRating");

        if (defenseFilter === "rated" && defense === null) return false;
        if (defenseFilter === "unrated" && defense !== null) return false;

        const defenseRange = RANGES[defenseFilter];

        if (
            defenseRange &&
            (defense === null ||
                defense < defenseRange[0] ||
                defense > defenseRange[1])
        ) {
            return false;
        }

        if (!terms.every((term) => name.includes(term))) return false;
        if (position && player.position !== position) return false;
        if (
            team &&
            !(player.teamsBySeason?.[teamSeason] ?? []).includes(team)
        ) {
            return false;
        }

        if (
            historyFilter !== "" &&
            Number(player.eligibleSeasons) !== Number(historyFilter)
        ) {
            return false;
        }

        if (ratingFilter === "rated" && rating === null) return false;
        if (ratingFilter === "unrated" && rating !== null) return false;

        const range = RANGES[ratingFilter];

        if (
            range &&
            (rating === null || rating < range[0] || rating > range[1])
        ) {
            return false;
        }

        return true;
    });

    matches.sort((a, b) => {
        const byName =
            a.player.localeCompare(b.player, "en", {
                sensitivity: "base"
            }) || String(a.playerId).localeCompare(String(b.playerId));

        if (sort === "name") return byName;
        if (sort === "name-desc") return -byName;

        const ratingField = sort.startsWith("defense-")
            ? "defenseRating"
            : "offenseRating";

        const first = ratingOf(a, ratingField);
        const second = ratingOf(b, ratingField);

        // Unrated players go last in either rating sort.
        if (first === null && second === null) return byName;
        if (first === null) return 1;
        if (second === null) return -1;

        return (
            (
                sort === "rating-high" || sort === "defense-high"
                    ? second - first
                    : first - second
            ) || byName
        );
    });

    const visiblePlayers = matches.slice(0, visibleCount);
    const hasFilters =
        query ||
        position ||
        ratingFilter ||
        defenseFilter ||
        historyFilter ||
        team ||
        teamSeason !== (teamSeasons[0] ?? "") ||
        sort !== "name";

    return (
        <div>
            <label
                htmlFor={`${id}-name`}
                className="mb-2 block text-sm font-medium text-slate-300"
            >
                Player name
            </label>
            <input
                id={`${id}-name`}
                type="search"
                value={query}
                placeholder="Search Pastrnak, McAvoy, Makar…"
                autoComplete="off"
                onChange={(event) => update(setQuery, event.target.value)}
                className={`${CONTROL_STYLE} placeholder:text-slate-500`}
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SelectControl
                    id={`${id}-team-season`}
                    label="Team affiliation season"
                    value={teamSeason}
                    onChange={(value) => {
                        setTeamSeason(value);
                        setTeam("");
                        setVisibleCount(PAGE_SIZE);
                    }}
                    options={teamSeasons.map((season) => [
                        season,
                        `${season.slice(0, 4)}–${season.slice(6, 8)}`
                    ])}
                />

                <SelectControl
                    id={`${id}-team`}
                    label="Team in selected season"
                    value={team}
                    onChange={(value) => update(setTeam, value)}
                    options={[
                        ["", "All teams"],
                        ...teamOptions.map((abbreviation) => [
                            abbreviation,
                            abbreviation
                        ])
                    ]}
                />
                <SelectControl
                    id={`${id}-position`}
                    label="Position"
                    value={position}
                    onChange={(value) => update(setPosition, value)}
                    options={[
                        ["", "All positions"],
                        ...Object.entries(POSITIONS)
                    ]}
                />

                <SelectControl
                    id={`${id}-rating`}
                    label="Offensive rating"
                    value={ratingFilter}
                    onChange={(value) => update(setRatingFilter, value)}
                    options={[
                        ["", "All ratings"],
                        ["rated", "Rated only"],
                        ["unrated", "Unrated"],
                        ...Object.keys(RANGES).map((range) => [range, range])
                    ]}
                />

                <SelectControl
                    id={`${id}-defense`}
                    label="Defensive rating"
                    value={defenseFilter}
                    onChange={(value) => update(setDefenseFilter, value)}
                    options={[
                        ["", "All ratings"],
                        ["rated", "Rated only"],
                        ["unrated", "Unrated"],
                        ...Object.keys(RANGES).map((range) => [range, range])
                    ]}
                />

                <SelectControl
                    id={`${id}-history`}
                    label="Eligible seasons"
                    value={historyFilter}
                    onChange={(value) => update(setHistoryFilter, value)}
                    options={[
                        ["", "Any history"],
                        ["0", "No eligible seasons"],
                        ["1", "1 season"],
                        ["2", "2 seasons"],
                        ["3", "3 seasons"]
                    ]}
                />

                <SelectControl
                    id={`${id}-sort`}
                    label="Sort by"
                    value={sort}
                    onChange={(value) => update(setSort, value)}
                    options={[
                        ["name", "Name A–Z"],
                        ["name-desc", "Name Z–A"],
                        ["rating-high", "Highest offense"],
                        ["rating-low", "Lowest offense"],
                        ["defense-high", "Highest defense"],
                        ["defense-low", "Lowest defense"]
                    ]}
                />
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Season selection applies to team affiliations only.
                Ratings remain historical. Traded players match every
                recorded team in the selected season; their profiles
                show combined full-season performance.
            </p>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Rating ranges use displayed grades. Ratings compare
                positional peers; use the position filter for a focused
                comparison. Unrated players appear last when sorting by rating.
            </p>

            <div className="my-5 flex flex-wrap items-center justify-between gap-3">
                <p role="status" className="text-sm text-slate-400">
                    {matches.length} {matches.length === 1 ? "player" : "players"}
                    {" · "}Showing {visiblePlayers.length}
                </p>

                {hasFilters && (
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="rounded px-2 py-1 text-sm text-sky-400 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-sky-400"
                    >
                        Reset filters and sorting
                    </button>
                )}
            </div>

            {matches.length === 0 ? (
                <p className="rounded-xl border border-slate-700 bg-[#101d32] p-6 text-slate-300">
                    No players match your filters. Try another name,
                    position, rating, or season count.
                </p>
            ) : (
                <ul className="space-y-3">
                    {visiblePlayers.map((player) => {
                        const rating = ratingOf(player);
                        const defense = ratingOf(player, "defenseRating");

                        return (
                            <li key={player.playerId}>
                                <Link
                                    href={`/players/${player.playerId}`}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-slate-700 bg-[#101d32] p-4 transition-colors hover:border-sky-400/60 hover:bg-[#15253d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                                >
                                    <div>
                                        <h2 className="text-base font-semibold text-white">
                                            {player.player}
                                        </h2>

                                        <p className="mt-1 text-sm text-slate-400">
                                            {POSITIONS[player.position] ?? player.position}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-400">
                                            {teamSeason
                                                ? `${teamSeason.slice(0, 4)}–${teamSeason.slice(6, 8)}: `
                                                : ""}
                                            {(player.teamsBySeason?.[teamSeason] ?? []).join(" · ") ||
                                                "No recorded affiliation"}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                            Historical ratings
                                        </p>

                                        <dl className="mt-2 grid gap-3 sm:grid-cols-2 sm:gap-5">
                                            <div>
                                                <dt className="text-xs text-slate-400">
                                                    Offense
                                                </dt>
                                                <dd className="mt-1 text-xl font-bold text-sky-300 tabular-nums">
                                                    {rating === null
                                                        ? "Unrated"
                                                        : `${rating.toFixed(1)} / 10`}
                                                </dd>
                                                <dd className="mt-1 text-xs text-slate-400">
                                                    {player.eligibleSeasons} eligible{" "}
                                                    {Number(player.eligibleSeasons) === 1
                                                        ? "season"
                                                        : "seasons"}
                                                </dd>
                                            </div>

                                            <div>
                                                <dt className="text-xs text-slate-400">
                                                    Defense
                                                </dt>
                                                <dd className="mt-1 text-xl font-bold text-sky-300 tabular-nums">
                                                    {defense === null
                                                        ? "Unrated"
                                                        : `${defense.toFixed(1)} / 10`}
                                                </dd>
                                                <dd className="mt-1 text-xs text-slate-400">
                                                    {player.defensiveEligibleSeasons} eligible{" "}
                                                    {Number(player.defensiveEligibleSeasons) === 1
                                                        ? "season"
                                                        : "seasons"}
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}

            {visiblePlayers.length < matches.length && (
                <button
                    type="button"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                    className="mt-6 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-sky-300 hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                    Show more players
                </button>
            )}
        </div>
    );
}