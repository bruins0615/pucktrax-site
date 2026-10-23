import modelConfig from "../config/model-config";

function number(value) {
    if (value == null || String(value).trim() === "") return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function format(value, decimals = 2) {
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

export default function PhysicalityPanel({ data }) {
    if (!data?.player) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">Physicality</h2>
                <p className="mt-3 text-sm text-slate-400">
                    Physicality statistics are unavailable for the latest
                    recorded season.
                </p>
            </section>
        );
    }

    const { player, seasons, baseline } = data;
    const value = number(player.hitsPerGame);
    const average = number(baseline?.mean);
    const deviation = number(baseline?.populationStandardDeviation);
    const eligible = player.sampleStatus === "Eligible";
    const minimum = modelConfig.minimumMinutes5v5;

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
            ? "Near position average"
            : z > 0
                ? "More hits per game than position average"
                : "Fewer hits per game than position average";

    const bonus = number(player.physicalityBonus);
    const uncapped = number(player.uncappedPhysicalityBonus);
    const capApplied = player.capApplied === "true";

    return (
        <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
            <h2 className="text-[19px] font-semibold">
                Recorded physical involvement
            </h2>
            <p className="mt-2 text-xs text-slate-400">
                {seasonLabel(player.season)} · All situations ·
                Auxiliary contribution
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-5">
                <Stat label="Total hits" value={format(player.hits, 0)} />
                <Stat label="Games played" value={format(player.gamesPlayed, 0)} />
            </dl>

            <section className="mt-6 border-t border-slate-700 pt-5">
                <h3 className="text-[15px] font-semibold">Hits /game</h3>
                <dl className="mt-4 grid grid-cols-2 gap-5">
                    <Stat label="Player" value={format(value)} />
                    <div className="border-l border-slate-700 pl-5">
                        <Stat
                            label={`Position average (${player.position})`}
                            value={format(average)}
                        />
                    </div>
                </dl>

                {canCompare ? (
                    <>
                        <div
                            aria-hidden="true"
                            className="mt-6 flex justify-between gap-2 text-[11px] text-slate-400"
                        >
                            <span>Fewer hits/game</span>
                            <span>Average</span>
                            <span>More hits/game</span>
                        </div>
                        <div
                            role="img"
                            aria-label={`Hits per game: ${value.toFixed(2)}, position average ${average.toFixed(2)}. ${comparison}.`}
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
                            : `Below ${minimum} five-on-five minutes — comparison not rated.`}
                    </p>
                )}

                <p className="mt-4 text-xs leading-relaxed text-slate-400">
                    {format(player.estimatedMinutes5v5, 0)} estimated
                    five-on-five minutes · {player.sampleStatus}.
                    Lower hit rates never produce a deduction.
                </p>

                <details className="mt-4 text-xs text-slate-400">
                    <summary className="cursor-pointer text-sky-400">
                        Comparison details
                    </summary>
                    <p className="mt-3 leading-relaxed">
                        Same-season positional baseline among{" "}
                        {baseline?.eligiblePlayers ?? "—"} players with at
                        least {minimum} five-on-five minutes. Each player
                        receives equal weight. Hits/game uses all recorded
                        games. Bars show standardized differences, clipped
                        at ±3 SD; they are not percentiles.
                    </p>
                </details>
            </section>

            <details className="mt-6 border-t border-slate-700 pt-5 text-xs text-slate-400">
                <summary className="cursor-pointer text-sm text-sky-400">
                    Three-season physicality history
                </summary>
                <div className="mt-4 space-y-4">
                    {seasons.map((season) => (
                        <div
                            key={season.season}
                            className="border-b border-slate-700 pb-4 last:border-0"
                        >
                            <h3 className="text-sm font-semibold text-white">
                                {seasonLabel(season.season)}
                            </h3>
                            <dl className="mt-3 grid grid-cols-3 gap-3">
                                <div>
                                    <dt>Games</dt>
                                    <dd className="mt-1 font-semibold text-white">
                                        {format(season.gamesPlayed, 0)}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Hits</dt>
                                    <dd className="mt-1 font-semibold text-white">
                                        {format(season.hits, 0)}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Hits/game</dt>
                                    <dd className="mt-1 font-semibold text-white">
                                        {format(season.hitsPerGame)}
                                    </dd>
                                </div>
                            </dl>
                            <p className="mt-3 leading-relaxed">
                                {format(season.estimatedMinutes5v5, 0)} estimated
                                5v5 minutes · {season.sampleStatus}
                            </p>
                        </div>
                    ))}
                </div>
                <p className="mt-4 leading-relaxed">
                    Recorded season statistics are shown separately.
                    No combined historical physicality grade is assigned.
                </p>
            </details>

            <details className="mt-6 border-t border-slate-700 pt-5 text-xs text-slate-400">
                <summary className="cursor-pointer text-sm text-sky-400">
                    Supporting statistics and bonus details
                </summary>

                <dl className="mt-4 space-y-3">
                    <div>
                        <dt>Hits per 60 all-situations minutes</dt>
                        <dd className="mt-1 font-semibold text-white">
                            {format(player.hitsPer60AllSituations)}
                        </dd>
                    </div>
                    <div>
                        <dt>Uncapped auxiliary bonus</dt>
                        <dd className="mt-1 font-semibold text-white">
                            {uncapped === null ? "—" : `+${uncapped.toFixed(3)}`}
                        </dd>
                    </div>
                    <div>
                        <dt>Capped auxiliary bonus</dt>
                        <dd className="mt-1 font-semibold text-sky-300">
                            {bonus === null ? "—" : `+${bonus.toFixed(3)}`}
                        </dd>
                    </div>
                </dl>

                <p className="mt-4 leading-relaxed">
                    {bonus === null
                        ? "No bonus calculated: below the eligibility minimum."
                        : capApplied
                            ? `The ${modelConfig.physicalityBonusCap.toFixed(2)} cap reduced the uncapped amount.`
                            : "The cap did not reduce this bonus."}
                </p>
                <p className="mt-3 leading-relaxed">
                    Above-average standardized hits/game receives a{" "}
                    {modelConfig.physicalityBonusCoefficient.toFixed(2)}
                    {" "}coefficient, capped at{" "}
                    {modelConfig.physicalityBonusCap.toFixed(2)}.
                    Average or below-average hitting earns zero.
                    These amounts are not direct additions to a 0–10 grade.
                    Overall-value contribution remains undecided.
                </p>
            </details>

            <p className="mt-6 text-xs leading-relaxed text-slate-400">
                Hits describe recorded physical involvement, not hit
                effectiveness or isolated player value. Blocks and takeaways
                are evaluated in Defense; penalties are in Discipline.
            </p>
        </section>
    );
}