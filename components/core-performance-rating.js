function number(value) {
    if (value == null || String(value).trim() === "") return null;

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function format(value, decimals = 3) {
    const result = number(value);
    return result === null ? "—" : result.toFixed(decimals);
}

function seasonLabel(value) {
    const season = String(value);
    return `${season.slice(0, 4)}–${season.slice(6, 8)}`;
}

export default function CorePerformanceRating({ data }) {
    const rating = number(data?.corePerformanceRating);
    const eligibleSeasons = number(data?.eligibleSeasons) ?? 0;
    const minutes = number(data?.minutes5v5InEligibleSeasons);

    const includedSeasons = (data?.includedSeasons ?? "")
        .split(",")
        .filter(Boolean);

    return (
        <section
            aria-labelledby="core-performance-heading"
            className="mt-6 border-t border-slate-700 pt-6"
        >
            <h2
                id="core-performance-heading"
                className="text-sm font-semibold"
            >
                Core performance
            </h2>

            <p className="mt-1 text-[11px] text-slate-400">
                Provisional historical composite
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="min-w-[100px] rounded-xl border border-slate-700 bg-[#17314b] px-4 py-4 text-center">
                    <p className="text-[42px] font-bold leading-none text-sky-300 tabular-nums">
                        {rating === null ? "—" : rating.toFixed(1)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                        {rating === null ? "Unrated" : "/ 10"}
                    </p>
                </div>

                <div className="text-xs leading-relaxed text-slate-300">
                    <p>
                        {eligibleSeasons} qualifying{" "}
                        {eligibleSeasons === 1 ? "season" : "seasons"}
                    </p>

                    {minutes !== null && (
                        <p className="mt-2 text-slate-400">
                            ≈{minutes.toLocaleString("en-US", {
                                maximumFractionDigits: 0
                            })} qualifying 5v5 min
                        </p>
                    )}
                </div>
            </div>

            {includedSeasons.length > 0 && (
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    Based on {includedSeasons.map(seasonLabel).join(", ")}
                </p>
            )}

            {rating === null && (
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {data?.historyStatus === "No eligible history"
                        ? "No qualifying historical sample."
                        : "A matched eligible offensive and defensive history is unavailable."}
                </p>
            )}

            <details className="mt-4 text-xs text-slate-400">
                <summary className="cursor-pointer text-sm text-sky-400">
                    About this core grade
                </summary>

                <div className="mt-3 space-y-3 leading-relaxed">
                    <p>
                        Combines 75% offensive index and 25% defensive
                        index before calculating a positional percentile.
                        The displayed offensive and defensive grades are
                        not averaged.
                    </p>

                    {rating !== null && (
                        <>
                            <p>
                                Compared with {data.comparisonGroupSize}{" "}
                                eligible players at the same latest recorded
                                NHL position ({data.position}). Percentile:{" "}
                                {format(data.percentile, 1)}.
                            </p>

                            <dl className="space-y-2">
                                <div className="flex justify-between gap-3">
                                    <dt>Weighted offense</dt>
                                    <dd className="font-semibold text-slate-200 tabular-nums">
                                        {format(data.offensiveContribution)}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt>Weighted defense</dt>
                                    <dd className="font-semibold text-slate-200 tabular-nums">
                                        {format(data.defensiveContribution)}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt>Combined index</dt>
                                    <dd className="font-semibold text-slate-200 tabular-nums">
                                        {format(data.corePerformanceIndex)}
                                    </dd>
                                </div>
                            </dl>
                        </>
                    )}

                    <p>
                        Qualifying histories share the comparison pool
                        regardless of season count. Shorter histories
                        provide less evidence of sustained performance.
                        A rounded 10.0 does not mean perfect performance.
                    </p>

                    <p>
                        Defensive inputs retain team and deployment effects.
                        This composite is not an estimate of goals or wins
                        contributed.
                    </p>

                    <p>
                        Availability and auxiliary categories are not
                        included. Contract value and projected ability
                        remain separate.
                    </p>
                </div>
            </details>
        </section>
    );
}