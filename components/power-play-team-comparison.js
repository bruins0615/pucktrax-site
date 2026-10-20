import modelConfig from "../config/model-config";

function number(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

export default function PowerPlayTeamComparison({ data }) {
    if (!data) {
        return (
            <p className="mt-6 text-sm text-slate-400">
                Team power-play comparison is unavailable.
            </p>
        );
    }

    const { player, teamBaseline } = data;
    const value = number(player.teamOnIcePowerPlayGoalsPerGame);
    const average = number(teamBaseline?.mean);
    const deviation = number(
        teamBaseline?.populationStandardDeviation
    );
    const minutes = number(player.powerPlayMinutes);
    const minimum = modelConfig.minimumPowerPlayMinutes;
    const eligible = player.sampleStatus === "Eligible";

    const canCompare =
        eligible &&
        value !== null &&
        average !== null &&
        deviation !== null &&
        deviation > 0 &&
        teamBaseline?.scalingStatus === "Available";

    const z = canCompare ? (value - average) / deviation : null;
    const clipped = canCompare
        ? Math.max(-3, Math.min(3, z))
        : null;

    const comparison = !canCompare
        ? "Comparison unavailable"
        : Math.abs(z) < 0.5
            ? "Near average"
            : z >= 1.5
                ? "Well above average"
                : z <= -1.5
                    ? "Well below average"
                    : z > 0
                        ? "Above average"
                        : "Below average";

    return (
        <section
            aria-labelledby="team-pp-heading"
            className="mt-6 border-t border-slate-700 pt-5"
        >
            <h4 id="team-pp-heading" className="text-sm font-semibold">
                Team on-ice PP goals /game
            </h4>

            <dl className="mt-4 grid grid-cols-2 gap-5">
                <div>
                    <dt className="text-xs text-slate-400">
                        With player on ice
                    </dt>
                    <dd className="mt-2 text-[35px] font-semibold tabular-nums">
                        {value === null ? "—" : value.toFixed(3)}
                    </dd>
                </div>

                <div className="border-l border-slate-700 pl-5">
                    <dt className="text-xs text-slate-400">
                        Position average ({player.position})
                    </dt>
                    <dd className="mt-2 text-[27px] font-medium tabular-nums">
                        {average === null ? "—" : average.toFixed(3)}
                    </dd>
                </div>
            </dl>

            <p className="mt-4 text-xs text-slate-400">
                {minutes === null ? "—" : minutes.toFixed(1)} PP minutes
                {" · "}
                {player.sampleStatus}
            </p>

            {!eligible && (
                <p className="mt-2 text-xs leading-relaxed text-sky-300">
                    Below {minimum} PP minutes — comparison not rated.
                    Recorded production is shown; this player is not included
                    in the baseline group.
                </p>
            )}

            {canCompare && (
                <>
                    <div
                        aria-hidden="true"
                        className="mt-6 flex justify-between gap-2 text-[11px] text-slate-400"
                    >
                        <span>Below average</span>
                        <span>Average</span>
                        <span>Above average</span>
                    </div>

                    <div
                        role="img"
                        aria-label={`Team PP goals per game: ${value.toFixed(3)}, position average ${average.toFixed(3)}. ${comparison}.`}
                        className="relative mt-3 h-2 rounded bg-slate-800"
                    >
                        <span
                            style={{
                                left: `${50 + Math.min(0, clipped) / 3 * 50}%`,
                                width: `${Math.abs(clipped) / 3 * 50}%`
                            }}
                            className="absolute top-0 h-2 rounded bg-gradient-to-r from-[#1b5db5] to-[#67bdec]"
                        />
                        <span className="absolute -top-[6px] left-1/2 h-5 w-px bg-slate-400/50" />
                    </div>

                    <p className="mt-3 text-right text-xs text-slate-300">
                        {comparison}
                    </p>
                </>
            )}

            <details className="mt-4 text-xs text-slate-400">
                <summary className="cursor-pointer text-sky-400">
                    Comparison details
                </summary>

                <p className="mt-3 leading-relaxed">
                    Same-season, same-position baseline among{" "}
                    {teamBaseline?.eligiblePlayers ?? "—"} players with at
                    least {minimum} PP minutes. Each eligible player
                    receives equal weight. Goals are divided by all games played.
                </p>

                <p className="mt-3 leading-relaxed">
                    {canCompare
                        ? `Standardized comparison: ${z.toFixed(2)} SD. Bars stop at ±3 SD; they are not percentiles.`
                        : !eligible
                            ? `Comparison not rated: below ${minimum} PP minutes.`
                            : "A standardized comparison is unavailable."}
                    {" "}Team PP results are context only and do not add
                    to the offensive rating.
                </p>
            </details>
        </section>
    );
}