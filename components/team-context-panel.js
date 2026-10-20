const METRICS = [
    {
        key: "teamEstimatedOnIceUnblockedAttemptsPer60_5v5",
        label: "Team unblocked attempts /60",
        situation: "Five-on-five · Estimated",
        note: "Includes shots on goal and missed shots; excludes blocked attempts."
    },
    {
        key: "teamOnIceGoalsForPer60EvenStrength",
        label: "Team goals for /60",
        situation: "Even strength",
        note: "Even strength includes situations beyond five-on-five."
    }
];

function number(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

export default function TeamContextPanel({ data }) {
    if (!data) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">Team context</h2>
                <p className="mt-3 text-sm text-slate-400">
                    Team-context statistics are unavailable for this
                    player’s latest recorded season.
                </p>
            </section>
        );
    }

    const { player, baselines } = data;
    const season =
        `${player.season.slice(0, 4)}–${player.season.slice(6, 8)}`;

    return (
        <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
            <h2 className="text-[19px] font-semibold">
                The team with {player.player} on the ice
            </h2>

            <p className="mt-2 text-xs text-slate-400">
                {season} · Position {player.position} comparisons · Context only
            </p>

            <div className="mt-6">
                {METRICS.map((metric) => {
                    const baseline = baselines.find(
                        (row) => row.metric === metric.key
                    );

                    const value = number(player[metric.key]);
                    const average = number(baseline?.mean);
                    const deviation = number(
                        baseline?.populationStandardDeviation
                    );

                    const canCompare =
                        value !== null &&
                        average !== null &&
                        deviation !== null &&
                        deviation > 0 &&
                        baseline?.scalingStatus === "Available";

                    const z = canCompare
                        ? (value - average) / deviation
                        : null;

                    const clipped = canCompare
                        ? Math.max(-3, Math.min(3, z))
                        : null;

                    return (
                        <section
                            key={metric.key}
                            className="border-b border-slate-700 py-6 first:pt-0 last:border-0"
                        >
                            <h3 className="text-[15px] font-semibold">
                                {metric.label}
                            </h3>

                            <p className="mt-1 text-xs text-slate-400">
                                {metric.situation}
                            </p>

                            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                                {metric.note}
                            </p>

                            <dl className="mt-5 grid grid-cols-2 gap-5">
                                <div>
                                    <dt className="text-xs text-slate-400">
                                        With player on ice
                                    </dt>
                                    <dd className="mt-2 text-[35px] font-semibold tabular-nums">
                                        {value === null ? "—" : value.toFixed(2)}
                                    </dd>
                                </div>

                                <div className="border-l border-slate-700 pl-5">
                                    <dt className="text-xs text-slate-400">
                                        Position average
                                    </dt>
                                    <dd className="mt-2 text-[25px] font-medium tabular-nums">
                                        {average === null ? "—" : average.toFixed(2)}
                                    </dd>
                                </div>
                            </dl>

                            {canCompare ? (
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
                                        aria-label={`${metric.label}: ${value.toFixed(2)}, position average ${average.toFixed(2)}; ${Math.abs(z).toFixed(2)} standard deviations ${z < 0 ? "below" : "above"} average`}
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

                                    <details className="mt-5 text-xs text-slate-400">
                                        <summary className="cursor-pointer text-sky-400">
                                            Comparison details
                                        </summary>
                                        <p className="mt-3 leading-relaxed">
                                            Compared with {baseline.eligiblePlayers} eligible
                                            players at the same position in this season.
                                            Standardized value: {z.toFixed(2)} SD.
                                            Bars stop at ±3 SD; they are not percentiles.
                                        </p>
                                    </details>
                                </>
                            ) : (
                                <p className="mt-4 text-xs text-slate-400">
                                    Comparison unavailable.
                                </p>
                            )}
                        </section>
                    );
                })}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-400">
                Sample: {player.sampleStatus}. Team results are unadjusted
                for teammates, opponents, and deployment. These figures
                do not add to the offensive rating.
            </p>
        </section>
    );
}