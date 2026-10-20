"use client";

import Link from "next/link";
import { useId, useState } from "react";

const POSITIONS = {
    C: "Center",
    L: "Left wing",
    R: "Right wing",
    D: "Defenseman"
};

const PAGE_SIZE = 40;

function normalize(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

export default function PlayerSearch({ players }) {
    const [query, setQuery] = useState("");
    const [position, setPosition] = useState("");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const id = useId();

    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);

    const matches = players.filter((player) => {
        const name = normalize(player.player);

        return (
            (!position || player.position === position) &&
            terms.every((term) => name.includes(term))
        );
    });

    const visiblePlayers = matches.slice(0, visibleCount);

    function resetFilters() {
        setQuery("");
        setPosition("");
        setVisibleCount(PAGE_SIZE);
    }

    return (
        <div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
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
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setVisibleCount(PAGE_SIZE);
                        }}
                        className="w-full rounded-xl border border-slate-600 bg-[#101d32] px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    />
                </div>

                <div>
                    <label
                        htmlFor={`${id}-position`}
                        className="mb-2 block text-sm font-medium text-slate-300"
                    >
                        Position
                    </label>
                    <select
                        id={`${id}-position`}
                        value={position}
                        onChange={(event) => {
                            setPosition(event.target.value);
                            setVisibleCount(PAGE_SIZE);
                        }}
                        className="w-full rounded-xl border border-slate-600 bg-[#101d32] px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    >
                        <option value="">All positions</option>
                        {Object.entries(POSITIONS).map(([code, label]) => (
                            <option key={code} value={code}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="my-5 flex flex-wrap items-center justify-between gap-3">
                <p role="status" className="text-sm text-slate-400">
                    {matches.length} {matches.length === 1 ? "player" : "players"}
                    {" · "}Showing {visiblePlayers.length}
                </p>

                {(query || position) && (
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="rounded px-2 py-1 text-sm text-sky-400 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-sky-400"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {matches.length === 0 ? (
                <p className="rounded-xl border border-slate-700 bg-[#101d32] p-6 text-slate-300">
                    No players match your search. Try another name or position.
                </p>
            ) : (
                <ul className="space-y-3">
                    {visiblePlayers.map((player) => {
                        const hasRating =
                            player.offenseRating != null &&
                            player.offenseRating !== "";

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
                                            {hasRating
                                                ? `${Number(player.offenseRating).toFixed(1)} / 10`
                                                : "Unrated"}
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