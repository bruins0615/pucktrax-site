import modelConfig from "../config/model-config";

function number(value) {
    if (value == null || String(value).trim() === "") return null;

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function grade(value) {
    const result = number(value);
    return result === null ? "—" : result.toFixed(1);
}

function seasonLabel(value) {
    const season = String(value);
    return `${season.slice(0, 4)}–${season.slice(6, 8)}`;
}

function explanation(record) {
    switch (record.participationStatus) {
        case "Eligible":
            return record.coverageStatus === "Verified zero"
                ? "Verified zero regular-season appearances. Included as 0.0."
                : "Included in the historical availability grade.";

        case "Below veteran minimum":
            return (
                `${record.careerGamesEnteringSeason} career games entering ` +
                `the season; ${modelConfig.minimumCareerGamesForAvailability} ` +
                "required. Season remains ungraded."
            );

        case "Not applicable":
            return (
                record.coverageNote ||
                "Outside NHL involvement. Excluded from availability grading."
            );

        default:
            return (
                "Season involvement has not been verified. " +
                "Games and grade remain unavailable, not zero."
            );
    }
}

export default function AvailabilityPanel({ data }) {
    if (!data?.historical || !data.seasons.length) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">Availability</h2>
                <p className="mt-3 text-sm text-slate-400">
                    Availability records are unavailable for this player.
                </p>
            </section>
        );
    }

    const { historical, seasons } = data;
    const included = Number(historical.eligibleSeasons);
    const incomplete = historical.historyStatus === "Incomplete coverage";
    const first = modelConfig.historicalSeasons[0];
    const last = modelConfig.latestCompletedSeason;

    return (
        <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
            <h2 className="text-[19px] font-semibold">
                Veteran season participation
            </h2>

            <p className="mt-2 text-xs text-slate-400">
                {String(first).slice(0, 4)}–{String(last).slice(6, 8)}
                {" · Regular season · Auxiliary category"}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-5">
                <div className="min-w-28 rounded-xl border border-slate-700 bg-[#17314c] px-5 py-4 text-center">
                    <p className="text-xs text-slate-300">
                        Historical availability
                    </p>
                    <p className="mt-2 text-[35px] font-bold leading-none text-sky-300 tabular-nums">
                        {grade(historical.availabilityRating)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">/ 10</p>
                </div>

                <div className="text-sm text-slate-300">
                    <p>
                        {included} included {included === 1 ? "season" : "seasons"}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                        {modelConfig.availabilityFullCreditGames}+ games earns
                        full season credit.
                    </p>
                    {included === 0 && (
                        <p className="mt-2 text-xs text-sky-300">
                            No eligible seasons to grade.
                        </p>
                    )}
                </div>
            </div>

            {incomplete && (
                <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-200">
                    <p className="font-semibold">Incomplete coverage</p>
                    <p className="mt-2 text-xs leading-relaxed">
                        {historical.unresolvedSeasons} veteran season(s) remain
                        unresolved. Any displayed average uses only the
                        included seasons and may change after review.
                    </p>
                </div>
            )}

            <p className="mt-5 text-xs leading-relaxed text-slate-400">
                Measures regular-season appearances, regardless of why games
                were missed. This is a fixed-benchmark grade, not a percentile
                or a measure of performance when playing.
            </p>

            <div className="mt-6 space-y-5 border-t border-slate-700 pt-5">
                <h3 className="text-sm font-semibold">
                    Season-by-season participation
                </h3>

                {seasons.map((record) => (
                    <section
                        key={record.season}
                        className="border-b border-slate-700 pb-5 last:border-0 last:pb-0"
                    >
                        <h4 className="text-sm font-semibold">
                            {seasonLabel(record.season)}
                        </h4>

                        <dl className="mt-3 grid grid-cols-2 gap-4">
                            <div>
                                <dt className="text-xs text-slate-400">
                                    Games played
                                </dt>
                                <dd className="mt-2 text-[27px] font-semibold tabular-nums">
                                    {number(record.gamesPlayed) ?? "—"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-slate-400">
                                    Season availability
                                </dt>
                                <dd className="mt-2 text-[27px] font-bold text-sky-300 tabular-nums">
                                    {grade(record.availabilityRating)}
                                    <span className="ml-1 text-xs font-normal text-slate-400">
                                        / 10
                                    </span>
                                </dd>
                            </div>
                        </dl>

                        <p className="mt-3 text-xs font-medium text-slate-300">
                            {record.participationStatus === "Not applicable"
                                ? "Outside NHL involvement"
                                : record.participationStatus}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-400">
                            {explanation(record)}
                        </p>
                    </section>
                ))}
            </div>

            <details className="mt-6 border-t border-slate-700 pt-5 text-xs text-slate-400">
                <summary className="cursor-pointer text-sm text-sky-400">
                    About this availability grade
                </summary>
                <div className="mt-3 space-y-3 leading-relaxed">
                    <p>
                        A season qualifies when the player entered it with at
                        least {modelConfig.minimumCareerGamesForAvailability}
                        {" "}career NHL regular-season appearances.
                    </p>
                    <p>
                        Season grade = games played ÷{" "}
                        {modelConfig.availabilityFullCreditGames} × 10,
                        capped at 10.0. Actual appearances above the benchmark
                        remain visible. The benchmark also applies to
                        84-game schedules.
                    </p>
                    <p>
                        Eligible seasons receive equal weight using unrounded
                        grades. Verified zero-game seasons count as 0.0.
                        Retired seasons and other documented exclusions do
                        not lower the average. Unresolved seasons remain
                        ungraded and trigger the coverage notice.
                    </p>
                    <p>
                        A shorter history provides less evidence of sustained
                        availability. No overall-value contribution has been
                        assigned.
                    </p>
                </div>
            </details>
        </section>
    );
}