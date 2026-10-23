function number(value) {
    if (value == null || String(value).trim() === "") return null;

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

export default function FaceoffComparison({
    player,
    baselines,
    metric,
    label,
    attempts,
    wins,
    status,
    note
}) {
    const baseline = baselines.find((row) => row.metric === metric);
    const value = number(player[metric]);
    const average = number(baseline?.mean);
    const deviation = number(baseline?.populationStandardDeviation);
    const drawCount = number(player[attempts]);
    const winCount = number(player[wins]);

    const eligible = [
        "Eligible",
        "Regular usage",
        "Draw-volume exception"
    ].includes(status);

    const canCompare =
        eligible &&
        value !== null &&
        average !== null &&
        deviation !== null &&
        deviation > 0 &&
        baseline?.scalingStatus === "Available";

    const z = canCompare ? (value - average) / deviation : null;
    const clipped = canCompare ? Math.max(-3, Math.min(3, z)) : null;

    const comparison = !canCompare
        ? "Comparison unavailable"
        : Math.abs(z) < 0.5
            ? "Near qualifying-player average"
            : z > 0
                ? "Above qualifying-player average"
                : "Below qualifying-player average";

    return (
        <section className="mt-6 border-t border-slate-700 pt-5">
            <h3 className="text-[15px] font-semibold">{label}</h3>

            <p className="mt-2 text-xs text-slate-400">
                {drawCount === null ? "—" : drawCount} draws
                {" · "}
                {winCount === null ? "—" : winCount} wins
                {" · "}
                {status}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-5">
                <div>
                    <dt className="text-xs text-slate-400">
                        Player win percentage
                    </dt>
                    <dd className="mt-2 text-[27px] font-semibold tabular-nums">
                        {value === null
                            ? "—"
                            : `${(value * 100).toFixed(1)}%`}
                    </dd>
                </div>
                <div className="border-l border-slate-700 pl-5">
                    <dt className="text-xs text-slate-400">
                        Qualifying-player average
                    </dt>
                    <dd className="mt-2 text-[25px] font-medium tabular-nums">
                        {average === null
                            ? "—"
                            : `${(average * 100).toFixed(1)}%`}
                    </dd>
                </div>
            </dl>

            {canCompare ? (
                <>
                    <div
                        aria-hidden="true"
                        className="mt-5 flex justify-between gap-2 text-[11px] text-slate-400"
                    >
                        <span>Lower win %</span>
                        <span>Average</span>
                        <span>Higher win %</span>
                    </div>

                    <div
                        role="img"
                        aria-label={`${label}: ${(value * 100).toFixed(1)} percent, qualifying-player average ${(average * 100).toFixed(1)} percent. ${comparison}.`}
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
            ) : (
                <p className="mt-4 text-xs text-sky-300">
                    {eligible
                        ? "Comparison unavailable."
                        : drawCount === 0
                            ? "No recorded draws in this situation."
                            : "Below qualification requirements — comparison not rated."}
                </p>
            )}

            <details className="mt-4 text-xs text-slate-400">
                <summary className="cursor-pointer text-sky-400">
                    Comparison details
                </summary>
                <p className="mt-3 leading-relaxed">{note}</p>
                <p className="mt-3 leading-relaxed">
                    Same-season baseline among{" "}
                    {baseline?.eligiblePlayers ?? "—"} qualifying players,
                    pooling NHL positions. Each player receives equal weight.
                    Bars show standardized differences, clipped at ±3 SD;
                    they are not percentiles.
                </p>
            </details>
        </section>
    );
}