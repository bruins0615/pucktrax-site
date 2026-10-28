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

export default function PerformanceRating({ data, core }) {
    const rating = number(data?.performanceRating);
    const count = number(data?.eligibleSeasons) ?? 0;
    const minutes = number(data?.minutes5v5InEligibleSeasons);
    const coreRating = number(core?.corePerformanceRating);

    const includedSeasons = (data?.includedSeasons ?? "")
        .split(",")
        .filter(Boolean);

    const contributions = [
        ["Weighted offense", core?.offensiveContribution],
        ["Weighted defense", core?.defensiveContribution],
        ["Core index", data?.corePerformanceIndex],
        ["Discipline adjustment", data?.disciplineAdjustment],
        ["Faceoff adjustment", data?.faceoffAdjustment],
        ["Physicality bonus", data?.historicalPhysicalityBonus],
        ["Performance index", data?.performanceIndex]
    ];

    return (
        <section
            aria-labelledby="performance-heading"
            className="mt-6 border-t border-slate-700 pt-6"
        >
            <h2
                id="performance-heading"
                className="text-sm font-bold uppercase tracking-wide"
            >
                Performance
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
                        {count} qualifying{" "}
                        {count === 1 ? "season" : "seasons"}
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
                    {data?.historyStatus === "No eligible matched history"
                        ? "No qualifying matched historical sample."
                        : "A matched eligible Performance result is unavailable."}
                    {coreRating !== null
                        ? ` Core remains available at ${coreRating.toFixed(1)} / 10.`
                        : ""}
                </p>
            )}

            <details className="mt-4 text-xs text-slate-400">
                <summary className="cursor-pointer text-sm text-sky-400">
                    About this Performance grade
                </summary>

                <div className="mt-3 space-y-3 leading-relaxed">
                    <p>
                        Core combines 75% offensive index and 25% defensive
                        index. Discipline, Faceoffs and Physicality adjust
                        that index before positional percentile grading.
                        Displayed category grades are not averaged.
                    </p>

                    <p>
                        Core grade:{" "}
                        <strong className="text-slate-200">
                            {coreRating === null
                                ? "Unrated"
                                : `${coreRating.toFixed(1)} / 10`}
                        </strong>
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
                                {contributions.map(([label, value]) => (
                                    <div
                                        key={label}
                                        className="flex justify-between gap-3"
                                    >
                                        <dt>{label}</dt>
                                        <dd className="font-semibold text-slate-200 tabular-nums">
                                            {format(value)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>

                            <p>
                                These are index contributions, not additions
                                to the displayed 0–10 grade. Values shown
                                here are rounded; calculations use full
                                precision.
                            </p>

                            <p>
                                Faceoff adjustment supported in{" "}
                                {data.faceoffSupportedSeasons} of{" "}
                                {data.eligibleSeasons} qualifying Core seasons.
                                Nonqualifying faceoff seasons receive no
                                adjustment, not a zero faceoff grade.
                            </p>

                            <p>
                                Physicality uses a positive-only 0.025
                                coefficient and a 0.25 season cap.
                                Capped season bonuses are averaged across
                                qualifying Core seasons, including zeros.
                            </p>
                        </>
                    )}

                    <p>
                        Shorter histories provide less evidence of sustained
                        performance. Grades can move when peers receive
                        adjustments, even without an individual deduction.
                        A rounded 10.0 does not mean perfect performance.
                    </p>

                    <p>
                        Defensive inputs retain team and deployment effects.
                        This composite is not an estimate of goals or wins
                        contributed.
                    </p>

                    <p>
                        Availability remains separate. This grade does not
                        measure contract value or projected ability.
                    </p>
                </div>
            </details>
        </section>
    );
}