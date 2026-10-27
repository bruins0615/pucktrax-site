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
    const [coreHistoryFilter, setCoreHistoryFilter] = useState("");
    const [recentCoreFilter, setRecentCoreFilter] = useState("");
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
        setCoreHistoryFilter("");
        setRecentCoreFilter("");
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
        if (
            coreHistoryFilter !== "" &&
            Number(player.coreEligibleSeasons) < Number(coreHistoryFilter)
        ) {
            return false;
        }

        if (
            recentCoreFilter === "qualified" &&
            !player.coreLatestSeasonQualified
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

        const ratingField = sort.startsWith("core-")
            ? "corePerformanceRating"
            : sort.startsWith("defense-")
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
                sort === "rating-high" ||
                    sort === "defense-high" ||
                    sort === "core-high"
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
        coreHistoryFilter ||
        recentCoreFilter ||
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
                    label="Offensive eligible seasons"
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
                    id={`${id}-core-history`}
                    label="Minimum qualifying core history"
                    value={coreHistoryFilter}
                    onChange={(value) => update(setCoreHistoryFilter, value)}
                    options={[
                        ["", "Any history"],
                        ["2", "2+ qualifying seasons"],
                        ["3", "3 qualifying seasons"]
                    ]}
                />

                <SelectControl
                    id={`${id}-core-recent`}
                    label="Latest completed season — core"
                    value={recentCoreFilter}
                    onChange={(value) => update(setRecentCoreFilter, value)}
                    options={[
                        ["", "No restriction"],
                        ["qualified", "Qualified in latest completed season"]
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
                        ["core-high", "Highest core performance"],
                        ["core-low", "Lowest core performance"],
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
                Provisional core performance combines 75% offensive index
                and 25% defensive index before positional percentile grading.
                Core history filters affect the displayed list only.
                Latest-season qualification refers to the historical
                window&apos;s final completed season, not the live season
                or the selected team-affiliation season.
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
                        const core = ratingOf(
                            player,
                            "corePerformanceRating"
                        );

                        const coreSeasons = Number(player.coreEligibleSeasons);

                        const coreMinutes =
                            player.coreMinutes5v5 == null ||
                                String(player.coreMinutes5v5).trim() === ""
                                ? null
                                : Number(player.coreMinutes5v5);

                        return (
                            <li
                                key={player.playerId}
                                className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-slate-700 bg-[#101d32] p-4 transition-colors hover:border-sky-400/60 hover:bg-[#15253d] focus-within:border-sky-400"
                            >
                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold text-white">
                                        <Link
                                            href={`/players/${player.playerId}`}
                                            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
                                        >
                                            {player.player}
                                        </Link>
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-400">
                                        {POSITIONS[player.position] ?? player.position}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                        {teamSeason
                                            ? `${teamSeason.slice(0, 4)}–${teamSeason.slice(6, 8)}: `
                                            : ""}
                                        {(player.teamsBySeason?.[teamSeason] ?? [])
                                            .join(" · ") || "No recorded affiliation"}
                                    </p>
                                </div>

                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <p className="text-[11px] font-medium uppercase tracking-wide text-white">
                                            Core
                                        </p>

                                        <details className="relative z-20 text-left">
                                            <summary
                                                aria-label={`About ${player.player}'s core performance grade`}
                                                className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-slate-400 hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-sky-400 [&::-webkit-details-marker]:hidden"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-semibold"
                                                >
                                                    i
                                                </span>
                                            </summary>

                                            <div className="absolute right-0 top-full mt-1 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-slate-600 bg-[#14243b] p-4 text-xs leading-relaxed text-slate-300 shadow-xl">
                                                <p className="font-semibold text-white">
                                                    Provisional core performance
                                                </p>

                                                <p className="mt-3">
                                                    Combines 75% offensive index
                                                    and 25% defensive index,
                                                    then grades the result
                                                    against positional peers.
                                                    Category grades are not
                                                    averaged.
                                                </p>

                                                <p className="mt-3">
                                                    {coreSeasons} qualifying{" "}
                                                    {coreSeasons === 1
                                                        ? "season"
                                                        : "seasons"}
                                                    {Number.isFinite(coreMinutes)
                                                        ? ` · ≈${coreMinutes.toLocaleString(
                                                            "en-US",
                                                            { maximumFractionDigits: 0 }
                                                        )} qualifying 5v5 minutes`
                                                        : ""}
                                                </p>

                                                {core !== null && (
                                                    <p className="mt-2">
                                                        Based on{" "}
                                                        {player.coreIncludedSeasons
                                                            .split(",")
                                                            .map((season) =>
                                                                `${season.slice(0, 4)}–${season.slice(6, 8)}`
                                                            )
                                                            .join(", ")}
                                                    </p>
                                                )}

                                                <p className="mt-3">
                                                    {core === null
                                                        ? "No matched eligible history is available for a combined grade."
                                                        : "Shorter histories provide less evidence of sustained performance."}
                                                </p>

                                                <p className="mt-3">
                                                    Availability and auxiliary
                                                    categories are not included.
                                                    This is not a contract-value
                                                    or projected-ability grade.
                                                </p>
                                            </div>
                                        </details>
                                    </div>

                                    <p className="text-[36px] font-bold leading-none text-sky-300 tabular-nums">
                                        {core === null ? (
                                            <span className="text-xl">Unrated</span>
                                        ) : (
                                            <>
                                                {core.toFixed(1)}
                                                <span className="ml-1 text-xs font-normal text-slate-400">
                                                    / 10
                                                </span>
                                            </>
                                        )}
                                    </p>

                                    <p className="mt-2 text-[11px] text-slate-400">
                                        {coreSeasons} qualifying{" "}
                                        {coreSeasons === 1 ? "season" : "seasons"}
                                    </p>

                                    <dl className="mt-3 flex justify-end gap-4 border-t border-slate-700 pt-3">
                                        <div className="min-w-16 text-center">
                                            <dt className="text-[11px] text-slate-400">
                                                Offense
                                            </dt>
                                            <dd className="mt-1 text-base font-semibold text-slate-200 tabular-nums">
                                                {rating === null
                                                    ? "—"
                                                    : rating.toFixed(1)}
                                            </dd>
                                        </div>

                                        <div className="min-w-16 text-center">
                                            <dt className="text-[11px] text-slate-400">
                                                Defense
                                            </dt>
                                            <dd className="mt-1 text-base font-semibold text-slate-200 tabular-nums">
                                                {defense === null
                                                    ? "—"
                                                    : defense.toFixed(1)}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
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