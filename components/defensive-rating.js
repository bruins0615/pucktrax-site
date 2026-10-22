function rating(value) {
    return value == null || value === ""
        ? "—"
        : Number(value).toFixed(1);
}

function percentile(value) {
    return value == null || value === ""
        ? "Unrated"
        : `${Number(value).toFixed(1)}th percentile`;
}

function seasonLabel(season) {
    return `${season.slice(0, 4)}–${season.slice(6, 8)}`;
}

const POSITION_GROUPS = {
    C: "centers",
    L: "left wings",
    R: "right wings",
    D: "defensemen"
};

export default function DefensiveRating({ historical, seasons = [] }) {
    if (!historical) {
        return (
            <p className="mt-6 text-sm text-slate-400">
                Defensive ratings are unavailable.
            </p>
        );
    }

    const hasRating =
        historical.defenseRating != null &&
        historical.defenseRating !== "";

    const window =
        `${historical.windowStart.slice(0, 4)}–` +
        historical.windowEnd.slice(6, 8);

    return (
        <section
            aria-labelledby="defense-heading"
            className="mt-6 border-t border-slate-700 pt-6"
        >
            <div className="flex items-center gap-4">
                <div
                    aria-label={`Defensive rating: ${hasRating
                            ? `${rating(historical.defenseRating)} out of 10`
                            : "unrated"
                        }`}
                    className="flex w-[90px] shrink-0 flex-col items-center rounded-xl border border-slate-700 bg-[#17314b] px-3 py-4"
                >
                    <h2
                        id="defense-heading"
                        className="text-[11px] font-medium uppercase tracking-widest text-slate-400"
                    >
                        Defense
                    </h2>
                    <p className="mt-1 text-[35px] font-bold leading-tight text-white tabular-nums">
                        {rating(historical.defenseRating)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">/ 10</p>
                </div>

                <div className="min-w-0 space-y-2 text-xs leading-relaxed">
                    <p className="font-medium text-white">
                        {percentile(historical.percentile)}
                    </p>
                    <p className="text-slate-400">
                        Among NHL{" "}
                        {POSITION_GROUPS[historical.position] ??
                            historical.position}
                        {" · "}
                        {window}
                    </p>
                    <p className="text-slate-400">
                        {historical.eligibleSeasons} eligible{" "}
                        {Number(historical.eligibleSeasons) === 1
                            ? "season"
                            : "seasons"}
                    </p>
                </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
                Provisional defense model
            </p>

            <details className="mt-5 border-t border-slate-700 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-sky-400">
                    About this defensive grade
                </summary>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
                    <p>
                        Comparison group:{" "}
                        <strong className="text-white">
                            {historical.comparisonGroupSize || "—"} players
                        </strong>{" "}
                        with the same latest recorded NHL position in this
                        window and at least one eligible season.
                    </p>
                    <p>
                        The foundation combines five-on-five unblocked-attempt
                        suppression (70%) and even-strength goal suppression
                        (30%). All-situations blocks and takeaways add positive
                        bonuses. Penalty killing has no separate contribution.
                    </p>
                    <p>
                        Seasons require at least 300 five-on-five minutes.
                        Eligible indices receive equal weight before positional
                        percentiles are calculated. Ties share a midpoint
                        percentile. The rating is percentile divided by 10,
                        rounded to one decimal.
                    </p>
                    <p>
                        On-ice results reflect teammates, goaltending, opponents
                        and deployment. This describes recorded defensive
                        performance, not isolated ability, overall value or
                        future performance. Shorter histories provide less
                        evidence. A rounded 10.0 does not mean perfection.
                    </p>
                </div>
            </details>

            <details className="mt-5 border-t border-slate-700 pt-4">
                <summary className="cursor-pointer text-sm text-slate-400">
                    Three-season defensive history
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    Season grades compare eligible players at the same
                    position in that season. The historical grade averages
                    underlying indices, not displayed grades.
                </p>

                {seasons.map((season) => (
                    <div
                        key={season.season}
                        className="border-b border-slate-800 py-4 last:border-0"
                    >
                        <div className="flex items-baseline justify-between gap-3">
                            <h3 className="text-sm font-semibold">
                                {seasonLabel(season.season)}
                            </h3>
                            <p className="text-xl font-bold text-sky-300 tabular-nums">
                                {rating(season.defenseRating)}
                                <span className="ml-1 text-xs font-normal text-slate-400">
                                    /10
                                </span>
                            </p>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                            {percentile(season.percentile)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            {season.gamesPlayed} games · ≈
                            {Number(season.estimatedMinutes5v5).toLocaleString(
                                "en-US",
                                { maximumFractionDigits: 0 }
                            )}{" "}
                            5v5 min
                        </p>
                    </div>
                ))}

                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    Minutes are estimated. A dash indicates an unrated
                    season; zero is a valid rating.
                </p>
            </details>
        </section>
    );
}