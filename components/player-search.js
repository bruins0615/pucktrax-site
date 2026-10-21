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

function ratingOf(player) {
    const value = player.offenseRating;

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
    const [query, setQuery] = useState("");
    const [position, setPosition] = useState("");
    const [ratingFilter, setRatingFilter] = useState("");
    const [historyFilter, setHistoryFilter] = useState("");
    const [sort, setSort] = useState("name");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const id = useId();

    function update(setter, value) {
        setter(value);
        setVisibleCount(PAGE_SIZE);
    }

    function resetFilters() {
        setQuery("");
        setPosition("");
        setRatingFilter("");
        setHistoryFilter("");
        setSort("name");
        setVisibleCount(PAGE_SIZE);
    }

    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);

    const matches = players.filter((player) => {
        const name = normalize(player.player);
        const rating = ratingOf(player);

        if (!terms.every((term) => name.includes(term))) return false;
        if (position && player.position !== position) return false;

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

        const first = ratingOf(a);
        const second = ratingOf(b);

        // Unrated players go last in either rating sort.
        if (first === null && second === null) return byName;
        if (first === null) return 1;
        if (second === null) return -1;

        return (
            (sort === "rating-high"
                ? second - first
                : first - second) || byName
        );
    });

    const visiblePlayers = matches.slice(0, visibleCount);
    const hasFilters =
        query || position || ratingFilter || historyFilter || sort !== "name";

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

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        ["rating-high", "Highest rating"],
                        ["rating-low", "Lowest rating"]
                    ]}
                />
            </div>

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
                                    </div>

                                    <div className="text-right">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                            Historical offense
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-sky-300 tabular-nums">
                                            {rating === null
                                                ? "Unrated"
                                                : `${rating.toFixed(1)} / 10`}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {player.eligibleSeasons} eligible{" "}
                                            {Number(player.eligibleSeasons) === 1
                                                ? "season"
                                                : "seasons"}
                                        </p>
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