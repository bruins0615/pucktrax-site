import modelConfig from "../config/model-config";

function number(value) {
    if (value == null || String(value).trim() === "") return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function format(value, decimals = 1) {
    const result = number(value);
    return result === null ? "—" : result.toFixed(decimals);
}

function seasonLabel(season) {
    return `${season.slice(0, 4)}–${season.slice(6, 8)}`;
}

function Stat({ label, value }) {
    return (
        <div>
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-2 text-[27px] font-semibold tabular-nums">
                {value}
            </dd>
        </div>
    );
}

function Comparison({ player, baselines, metric, label, lowerIsBetter }) {
    const baseline = baselines.find((row) => row.metric === metric);
    const value = number(player[metric]);
    const average = number(baseline?.mean);
    const deviation = number(baseline?.populationStandardDeviation);
    const eligible = player.sampleStatus === "Eligible";

    const canCompare =
        eligible &&
        value !== null &&
        average !== null &&
        deviation !== null &&
        deviation > 0 &&
        baseline?.scalingStatus === "Available";

    const z = canCompare
        ? (lowerIsBetter ? average - value : value - average) / deviation
        : null;

    const clipped = canCompare ? Math.max(-3, Math.min(3, z)) : null;

    const description = !canCompare
        ? "Comparison unavailable"
        : Math.abs(z) < 0.5
            ? "Near position average"
            : (lowerIsBetter ? z > 0 : z < 0)
                ? "Below position average"
                : "Above position average";

    return (
        <section className="mt-6 border-t border-slate-700 pt-5">
            <h3 className="text-[15px] font-semibold">{label}</h3>

            <dl className="mt-4 grid grid-cols-2 gap-5">
                <Stat label="Player" value={format(value, 3)} />
                <div className="border-l border-slate-700 pl-5">
                    <Stat
                        label={`Position average (${player.position})`}
                        value={format(average, 3)}
                    />
                </div>
            </dl>

            {canCompare ? (
                <>
                    <div
                        aria-hidden="true"
                        className="mt-6 flex justify-between gap-2 text-[11px] text-slate-400"
                    >
                        <span>
                            {lowerIsBetter ? "More PIM/game" : "Fewer drawn/game"}
                        </span>
                        <span>Average</span>
                        <span>
                            {lowerIsBetter ? "Fewer PIM/game" : "More drawn/game"}
                        </span>
                    </div>

                    <div
                        role="img"
                        aria-label={`${label}: ${value.toFixed(3)}, position average ${average.toFixed(3)}. ${description}.`}
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
                        {description}
                    </p>
                </>
            ) : (
                <p className="mt-4 text-xs text-sky-300">
                    {eligible
                        ? "Comparison unavailable."
                        : `Below ${modelConfig.minimumMinutes5v5} five-on-five minutes — comparison not rated.`}
                </p>
            )}

            <details className="mt-4 text-xs text-slate-400">
                <summary className="cursor-pointer text-sky-400">
                    Comparison details
                </summary>
                <p className="mt-3 leading-relaxed">
                    Same-season positional average among{" "}
                    {baseline?.eligiblePlayers ?? "—"} players with at least{" "}
                    {modelConfig.minimumMinutes5v5} five-on-five minutes.
                    Each player receives equal weight. Per-game figures
                    use all recorded games. Bars show standardized
                    differences, clipped at ±3 SD; they are not percentiles.
                </p>
            </details>
        </section>
    );
}

export default function DisciplinePanel({ data }) {
    if (!data) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">Discipline</h2>
                <p className="mt-3 text-sm text-slate-400">
                    Discipline statistics are unavailable.
                </p>
            </section>
        );
    }

    const { historical, seasons, player, baselines } = data;
    const historicalPercentile = number(historical?.percentile);
    const net = number(player?.netPenalties);
    const drawingBonus = number(player?.penaltiesDrawnBonus);

    return (
        <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
            <h2 className="text-[19px] font-semibold">Discipline</h2>

            {historical ? (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-5">
                        <div className="rounded-xl border border-slate-700 bg-[#17314b] px-5 py-4 text-center">
                            <p className="text-xs text-slate-400">
                                Historical discipline
                            </p>
                            <p className="mt-1 text-[35px] font-bold tabular-nums">
                                {format(historical.disciplineRating)}
                                <span className="ml-2 text-sm font-normal text-slate-400">
                                    /10
                                </span>
                            </p>
                        </div>
                        <div className="space-y-2 text-xs text-slate-400">
                            <p className="font-medium text-white">
                                {historicalPercentile === null
                                    ? "Unrated"
                                    : `${historicalPercentile.toFixed(1)}th percentile`}
                            </p>
                            <p>
                                {historical.windowStart.slice(0, 4)}–
                                {historical.windowEnd.slice(6, 8)}
                                {" · Position "}{historical.position}
                            </p>
                            <p>
                                {historical.eligibleSeasons} eligible{" "}
                                {Number(historical.eligibleSeasons) === 1
                                    ? "season"
                                    : "seasons"}
                            </p>
                        </div>
                    </div>

                    <details className="mt-5 text-xs text-slate-400">
                        <summary className="cursor-pointer text-sky-400">
                            About this discipline grade
                        </summary>
                        <div className="mt-3 space-y-3 leading-relaxed">
                            <p>
                                Lower PIM/game than the positional average
                                improves the foundation. Above-average penalties
                                drawn/game earns a positive bonus with a 0.10
                                coefficient. Drawing at or below average adds
                                zero, never a deduction. Net penalties is
                                display context only.
                            </p>
                            <p>
                                Eligible season indices receive equal weight
                                before comparison with{" "}
                                {historical.comparisonGroupSize || "—"} players
                                at the same latest recorded position. Ties share
                                a midpoint percentile. Percentile divided by 10
                                gives the grade, rounded to one decimal.
                            </p>
                            <p>
                                All penalty types are included. These figures
                                do not equal power-play opportunities or measure
                                intent, momentum or teammate protection.
                                Shorter histories provide less evidence.
                                A rounded 10.0 does not mean perfection.
                                No overall-player contribution is assigned.
                            </p>
                        </div>
                    </details>

                    <details className="mt-5 text-xs text-slate-400">
                        <summary className="cursor-pointer text-sky-400">
                            Three-season discipline history
                        </summary>
                        {seasons.map((season) => (
                            <div
                                key={season.season}
                                className="mt-3 border-b border-slate-700 pb-3"
                            >
                                <div className="flex justify-between gap-3">
                                    <span>{seasonLabel(season.season)}</span>
                                    <strong className="text-sky-300">
                                        {format(season.disciplineRating)} /10
                                    </strong>
                                </div>
                                <p className="mt-2">
                                    {season.gamesPlayed} games · ≈
                                    {format(season.estimatedMinutes5v5, 0)} 5v5 min
                                </p>
                            </div>
                        ))}
                        <p className="mt-3 leading-relaxed">
                            A dash means unrated; zero is valid. The historical
                            grade averages indices, not displayed season grades.
                        </p>
                    </details>
                </>
            ) : (
                <p className="mt-4 text-sm text-slate-400">
                    Historical discipline rating unavailable.
                </p>
            )}

            {player ? (
                <>
                    <h3 className="mt-7 border-t border-slate-700 pt-5 text-[17px] font-semibold">
                        {seasonLabel(player.season)} recorded discipline
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">
                        {player.gamesPlayed} games · ≈
                        {format(player.estimatedMinutes5v5, 0)} five-on-five
                        minutes · {player.sampleStatus}
                    </p>

                    <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
                        <Stat label="Penalty minutes" value={format(player.penaltyMinutes, 0)} />
                        <Stat label="Penalties taken" value={format(player.penaltiesTaken, 0)} />
                        <Stat label="Penalties drawn" value={format(player.penaltiesDrawn, 0)} />
                        <Stat
                            label="Net penalties"
                            value={net === null ? "—" : `${net > 0 ? "+" : ""}${net}`}
                        />
                    </dl>

                    <Comparison
                        player={player}
                        baselines={baselines}
                        metric="penaltyMinutesPerGame"
                        label="Penalty minutes /game"
                        lowerIsBetter
                    />
                    <Comparison
                        player={player}
                        baselines={baselines}
                        metric="penaltiesDrawnPerGame"
                        label="Penalties drawn /game"
                        lowerIsBetter={false}
                    />

                    <details className="mt-6 border-t border-slate-700 pt-5">
                        <summary className="cursor-pointer text-sm text-sky-400">
                            Score calculation details
                        </summary>

                        <dl className="mt-4 grid grid-cols-2 gap-5">
                            <Stat
                                label="Season foundation"
                                value={format(player.disciplineFoundation, 3)}
                            />
                            <Stat
                                label="Drawing index bonus"
                                value={drawingBonus === null
                                    ? "—"
                                    : `+${drawingBonus.toFixed(3)}`}
                            />
                        </dl>

                        <p className="mt-4 text-xs leading-relaxed text-slate-400">
                            Components contribute to the season index, not directly
                            to the 0–10 grade. A below-average drawing comparison
                            does not produce a negative bonus.
                        </p>
                    </details>
                </>
            ) : (
                <p className="mt-6 text-sm text-slate-400">
                    Discipline statistics for the latest recorded season
                    are unavailable.
                </p>
            )}
        </section>
    );
}