const METRICS = [
    ["goalsPer605v5", "Goals"],
    ["primaryAssistsPer605v5", "Primary assists"],
    ["secondaryAssistsPer605v5", "Secondary assists"],
    ["individualShotsForPer60", "Shots on goal"]
];

function readNumber(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export default function FiveOnFivePanel({ data }) {
    if (!data) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">
                    Five-on-five
                </h2>
                <p className="mt-3 text-sm text-slate-400">
                    Five-on-five statistics are unavailable.
                </p>
            </section>
        );
    }

    const { player, baselines } = data;
    const season =
        `${player.season.slice(0, 4)}–${player.season.slice(6, 8)}`;

    const rows = METRICS.map(([metric, label]) => {
        const baseline = baselines.find(
            (row) => row.metric === metric
        );

        const value = readNumber(player[metric]);
        const average = readNumber(baseline?.mean);
        const deviation = readNumber(
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

        const displayedZ = canCompare
            ? Math.max(-3, Math.min(3, z))
            : null;

        return {
            metric,
            label,
            baseline,
            value,
            average,
            z,
            displayedZ,
            canCompare
        };
    });

    return (
        <section
            aria-labelledby="five-on-five-heading"
            className="rounded-xl border border-slate-700 bg-[#101d32] p-[18px] leading-[1.5] sm:p-6"
        >
            <h2
                id="five-on-five-heading"
                className="text-[19px] font-semibold tracking-[-0.4px]"
            >
                Where the offense stands out
            </h2>

            <p className="mt-[7px] text-xs text-slate-400">
                {season} · Individual production per 60 five-on-five minutes
            </p>

            <div
                aria-hidden="true"
                className="mt-[25px] flex gap-2 text-[11px] text-slate-400"
            >
                <span className="flex-1">Below average</span>
                <span className="flex-1 text-center">
                    {player.position} average
                </span>
                <span className="flex-1 text-right">Above average</span>
            </div>

            <div>
                {rows.map((row) => (
                    <div
                        key={row.metric}
                        className="border-b border-slate-700 py-[21px] last:border-0"
                    >
                        <div className="flex items-baseline justify-between gap-3">
                            <h3 className="text-[15px] font-semibold">
                                {row.label}
                            </h3>

                            <p className="whitespace-nowrap text-[25px] font-semibold tracking-[-0.7px] text-white tabular-nums sm:text-[27px]">
                                {row.value === null
                                    ? "—"
                                    : row.value.toFixed(3)}
                                <span className="ml-1 text-xs font-normal tracking-normal text-slate-400">
                                    /60
                                </span>
                            </p>
                        </div>

                        <p className="mb-[15px] mt-[2px] text-xs text-slate-400 tabular-nums">
                            Position average:{" "}
                            {row.average === null
                                ? "—"
                                : row.average.toFixed(3)}
                        </p>

                        {row.canCompare ? (
                            <div
                                role="img"
                                aria-label={`${row.label}: ${row.value.toFixed(3)} per 60, position average ${row.average.toFixed(3)}; ${Math.abs(row.z).toFixed(2)} standard deviations ${row.z < 0 ? "below" : "above"} average`}
                            >
                                <div className="relative mb-[9px] mt-2 h-2 rounded bg-slate-800">
                                    <span
                                        style={{
                                            left: `${50 + Math.min(0, row.displayedZ) / 3 * 50}%`,
                                            width: `${Math.abs(row.displayedZ) / 3 * 50}%`
                                        }}
                                        className="absolute top-0 h-2 rounded bg-gradient-to-r from-[#1b5db5] to-[#67bdec]"
                                    />

                                    <span className="absolute -top-[6px] left-1/2 h-5 w-px bg-slate-400/50" />
                                </div>

                                <p
                                    aria-hidden="true"
                                    className="text-right text-xs text-slate-300"
                                >
                                    {Math.abs(row.z) < 0.5
                                        ? "Near average"
                                        : row.z >= 1.5
                                            ? "Well above average"
                                            : row.z <= -1.5
                                                ? "Well below average"
                                                : row.z > 0
                                                    ? "Above average"
                                                    : "Below average"}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                Comparison unavailable.
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <p className="pt-4 text-xs text-slate-400">
                Position: {player.position} · Sample: {player.sampleStatus}
            </p>

            <details className="mt-5 text-xs text-slate-400">
                <summary className="cursor-pointer py-[10px] text-sky-400">
                    Numbers and comparison method
                </summary>

                <p className="mt-2 leading-relaxed">
                    Standardized comparison = (player rate − position
                    average) ÷ positional standard deviation. Bars extend
                    from the average toward the player’s value and stop
                    at three standard deviations in either direction.
                    These bars are not percentiles.
                </p>

                <dl className="mt-4 space-y-3">
                    {rows.map((row) => (
                        <div
                            key={row.metric}
                            className="flex flex-wrap justify-between gap-2"
                        >
                            <dt>{row.label}</dt>
                            <dd className="text-slate-200 tabular-nums">
                                {row.canCompare
                                    ? `${row.z > 0 ? "+" : ""}${row.z.toFixed(2)} SD · ${row.baseline.eligiblePlayers} players`
                                    : "Unavailable"}
                            </dd>
                        </div>
                    ))}
                </dl>
            </details>
        </section>
    );
}