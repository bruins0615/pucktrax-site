import modelConfig from "../config/model-config";
import DefensiveActions from "./defensive-actions";

const METRICS = [
    {
        key: "teamEstimatedOnIceUnblockedAttemptsAgainstPer60_5v5",
        label: "Team unblocked attempts against /60",
        situation: "Five-on-five · Estimated minutes",
        note: "Shots on goal and missed shots allowed while on ice."
    },
    {
        key: "teamOnIceGoalsAgainstPer60EvenStrength",
        label: "Team goals against /60",
        situation: "Even strength",
        note: "Uses even-strength ice time, including situations beyond five-on-five."
    }
];

function number(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

export default function DefensivePanel({ data, score }) {
    if (!data?.player) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">Defensive analysis</h2>
                <p className="mt-3 text-sm text-slate-400">
                    Defensive statistics are unavailable.
                </p>
            </section>
        );
    }

    const { player, baselines } = data;
    const eligible = player.sampleStatus === "Eligible";
    const minimum = modelConfig.minimumMinutes5v5;
    const season =
        `${player.season.slice(0, 4)}–${player.season.slice(6, 8)}`;

    return (
        <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
            <h2 className="text-[19px] font-semibold">
                Limiting opposition offense
            </h2>
            <p className="mt-2 text-xs text-slate-400">
                {season} · Latest recorded season · Lower rates are better
            </p>

            {!eligible && (
                <p className="mt-4 text-sm text-sky-300">
                    Below {minimum} five-on-five minutes. Recorded statistics
                    remain visible; comparisons are not rated.
                </p>
            )}

            {METRICS.map((metric) => {
                const baseline = baselines.find(
                    (row) => row.metric === metric.key
                );

                const value = number(player[metric.key]);
                const average = number(baseline?.mean);
                const deviation = number(baseline?.populationStandardDeviation);

                const canCompare =
                    eligible &&
                    value !== null &&
                    average !== null &&
                    deviation !== null &&
                    deviation > 0 &&
                    baseline?.scalingStatus === "Available";

                const z = canCompare ? (average - value) / deviation : null;
                const clipped = canCompare
                    ? Math.max(-3, Math.min(3, z))
                    : null;

                const comparison = !canCompare
                    ? "Comparison unavailable"
                    : Math.abs(z) < 0.5
                        ? "Near position average"
                        : z > 0
                            ? "Fewer than position average"
                            : "More than position average";

                return (
                    <section
                        key={metric.key}
                        className="mt-6 border-b border-slate-700 pb-6"
                    >
                        <h3 className="text-[15px] font-semibold">
                            {metric.label}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                            {metric.situation}
                        </p>
                        <p className="mt-3 text-xs text-slate-400">
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
                                    Position average ({player.position})
                                </dt>
                                <dd className="mt-2 text-[25px] font-medium tabular-nums">
                                    {average === null ? "—" : average.toFixed(2)}
                                </dd>
                            </div>
                        </dl>

                        {canCompare && (
                            <>
                                <div
                                    aria-hidden="true"
                                    className="mt-6 flex justify-between gap-2 text-[11px] text-slate-400"
                                >
                                    <span>More against</span>
                                    <span>Average</span>
                                    <span>Fewer against</span>
                                </div>
                                <div
                                    role="img"
                                    aria-label={`${metric.label}: ${value.toFixed(2)}, position average ${average.toFixed(2)}. ${comparison}.`}
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

                        {eligible && !canCompare && (
                            <p className="mt-4 text-xs text-slate-400">
                                Comparison unavailable.
                            </p>
                        )}

                        <details className="mt-4 text-xs text-slate-400">
                            <summary className="cursor-pointer text-sky-400">
                                Comparison details
                            </summary>
                            <p className="mt-3 leading-relaxed">
                                Same-season positional average among{" "}
                                {baseline?.eligiblePlayers ?? "—"} players with
                                at least {minimum} five-on-five minutes.
                                Each player receives equal weight.
                                Bars show standardized suppression, clipped
                                at ±3 SD; they are not percentiles.
                            </p>
                        </details>
                    </section>
                );
            })}

            <DefensiveActions player={player} score={score} />

            <p className="mt-5 text-xs leading-relaxed text-slate-400">
                These are shared on-ice results, unadjusted for teammates,
                goaltending, opponents and deployment. This panel shows one
                season; the main defensive grade summarizes eligible seasons
                within the historical window.
            </p>
        </section>
    );
}