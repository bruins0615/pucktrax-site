import modelConfig from "../config/model-config";

function number(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

export default function PenaltyKillComparison({ data }) {
    const player = data?.player;

    if (!player) {
        return (
            <p className="mt-5 text-sm text-slate-400">
                Penalty-killing comparison is unavailable.
            </p>
        );
    }

    const baseline = data.baselines.find(
        (row) =>
            row.metric === "teamOnIcePowerPlayGoalsAgainstPerGame"
    );

    const value = number(player.teamOnIcePowerPlayGoalsAgainstPerGame);
    const average = number(baseline?.mean);
    const deviation = number(baseline?.populationStandardDeviation);
    const eligible = player.shortHandedSampleStatus === "Eligible";
    const minimum = modelConfig.minimumShortHandedMinutes;

    const canCompare =
        eligible &&
        value !== null &&
        average !== null &&
        deviation !== null &&
        deviation > 0 &&
        baseline?.scalingStatus === "Available";

    // Positive values point toward fewer goals against per game.
    const z = canCompare ? (average - value) / deviation : null;
    const clipped = canCompare ? Math.max(-3, Math.min(3, z)) : null;

    const comparison = !canCompare
        ? "Comparison unavailable"
        : Math.abs(z) < 0.5
            ? "Near position average"
            : z > 0
                ? "Fewer goals against per game"
                : "More goals against per game";

    return (
        <section className="mt-6 border-t border-slate-700 pt-5">
            <h4 className="text-sm font-semibold">
                Team on-ice PP goals against /game
            </h4>

            <dl className="mt-4 grid grid-cols-2 gap-5">
                <div>
                    <dt className="text-xs text-slate-400">
                        With player penalty killing
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

            {!eligible && (
                <p className="mt-3 text-xs text-sky-300">
                    Below {minimum} SH minutes — comparison not rated.
                    Recorded statistics remain visible.
                </p>
            )}

            {canCompare && (
                <>
                    <div
                        aria-hidden="true"
                        className="mt-6 flex justify-between gap-2 text-[11px] text-slate-400"
                    >
                        <span>More against/game</span>
                        <span>Average</span>
                        <span>Fewer against/game</span>
                    </div>

                    <div
                        role="img"
                        aria-label={`Goals against per game: ${value.toFixed(3)}, position average ${average.toFixed(3)}. ${comparison}.`}
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
                    Same-season, same-position average among{" "}
                    {baseline?.eligiblePlayers ?? "—"} players with at least{" "}
                    {minimum} SH minutes. Each player receives equal weight.
                    Goals are divided by all recorded games played.
                    Bars show standardized differences, clipped at ±3 SD;
                    they are not percentiles.
                </p>
                <p className="mt-3 leading-relaxed">
                    Goals against/game reflects both workload and outcomes.
                    Read alongside SH time/game. These shared team results
                    are context only and do not separately contribute to
                    the defensive rating.
                </p>
            </details>
        </section>
    );
}