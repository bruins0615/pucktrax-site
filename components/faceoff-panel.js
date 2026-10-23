import FaceoffComparison from "./faceoff-comparison";
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

const ZONES = [
    ["defensiveZone", "Defensive zone", "50%"],
    ["offensiveZone", "Offensive zone", "30%"],
    ["neutralZone", "Neutral zone", "20%"]
];

function combinedGradeExplanation(record) {
    if (!record) {
        return "Combined grade unavailable: season data is unavailable.";
    }

    const rules = modelConfig.faceoffEligibility;
    const total = number(record.totalFaceoffs);

    if (total === null) {
        return "Combined grade unavailable: overall draw count is unavailable.";
    }

    if (total === 0) {
        return "Not applicable: no recorded faceoffs this season.";
    }

    if (total < rules.minimumOverallDraws) {
        return (
            `Combined grade unavailable: ${total} overall draws; ` +
            `${rules.minimumOverallDraws} required.`
        );
    }

    const missingZones = ZONES.flatMap(([zone, label]) => {
        const draws = number(record[`${zone}Faceoffs`]);

        if (draws === null) {
            return [`${label.toLowerCase()} draw count unavailable`];
        }

        return draws < rules.minimumZoneDraws
            ? [
                `${draws} ${label.toLowerCase()} draws ` +
                `(${rules.minimumZoneDraws} required)`
            ]
            : [];
    });

    return missingZones.length > 0
        ? `Combined grade unavailable: ${missingZones.join("; ")}.`
        : "Combined grade unavailable: calculated rating is unavailable.";
}

export default function FaceoffPanel({ data }) {
    if (!data) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">Faceoffs</h2>
                <p className="mt-3 text-sm text-slate-400">
                    Faceoff statistics are unavailable.
                </p>
            </section>
        );
    }

    const { historical, seasons, player, score, baselines } = data;
    const rules = modelConfig.faceoffEligibility;
    const historicalPercentile = number(historical?.percentile);

    const includedSeasons = historical?.includedSeasons
        ? historical.includedSeasons.split(",").map(seasonLabel).join(", ")
        : "None";

    const combinedEligible = score?.sampleStatus === "Eligible";

    const contextNote =
        `Requires ${rules.minimumOverallDraws} overall draws and either ` +
        `${rules.minimumSpecialTeamsMinutes} situational minutes with ` +
        `${rules.minimumSpecialTeamsDraws} situational draws, or ` +
        `${rules.minimumSpecialistDraws} situational draws regardless of minutes. ` +
        "Context only; no additional contribution to the combined index.";

    return (
        <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
            <h2 className="text-[19px] font-semibold">Faceoffs</h2>
            <p className="mt-2 text-xs text-slate-400">
                Auxiliary contribution · Qualifying takers across all positions
            </p>

            {historical ? (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-5">
                        <div className="rounded-xl border border-slate-700 bg-[#17314b] px-5 py-4 text-center">
                            <p className="text-xs text-slate-400">
                                Historical faceoffs
                            </p>
                            <p className="mt-1 text-[35px] font-bold tabular-nums">
                                {format(historical.faceoffRating)}
                                <span className="ml-2 text-sm font-normal text-slate-400">
                                    /10
                                </span>
                            </p>
                        </div>

                        <div className="space-y-2 text-xs text-slate-400">
                            <p className="font-medium text-white">
                                {historicalPercentile === null
                                    ? historical.historyStatus === "Not applicable"
                                        ? "Not applicable"
                                        : "Unrated"
                                    : `${historicalPercentile.toFixed(1)}th percentile`}
                            </p>
                            <p>
                                {historical.windowStart.slice(0, 4)}–
                                {historical.windowEnd.slice(6, 8)}
                                {" · "}
                                {historical.eligibleSeasons} eligible{" "}
                                {Number(historical.eligibleSeasons) === 1
                                    ? "season"
                                    : "seasons"}
                            </p>
                            <p>Included seasons: {includedSeasons}</p>
                        </div>
                    </div>

                    {player && !combinedEligible &&
                        historicalPercentile !== null && (
                            <p className="mt-4 text-sm leading-relaxed text-sky-300">
                                The historical grade uses earlier eligible seasons.
                                The latest recorded season does not qualify for
                                a combined faceoff grade.
                            </p>
                        )}

                    <details className="mt-5 text-xs text-slate-400">
                        <summary className="cursor-pointer text-sky-400">
                            About this faceoff grade
                        </summary>
                        <div className="mt-3 space-y-3 leading-relaxed">
                            <p>
                                The index combines standardized zone win
                                percentages: 50% defensive, 30% offensive and
                                20% neutral. Each season requires at least{" "}
                                {rules.minimumOverallDraws} total draws and{" "}
                                {rules.minimumZoneDraws} in every zone.
                                Missing zone weights are never redistributed.
                            </p>
                            <p>
                                Eligible season indices receive equal weight.
                                The historical average is compared with{" "}
                                {historical.comparisonGroupSize || "—"} qualifying
                                players across all positions. Ties share a
                                midpoint percentile. Percentile divided by 10
                                gives the grade, rounded to one decimal.
                            </p>
                            <p>
                                A shorter history provides less evidence.
                                A rounded 10.0 does not mean perfection.
                                No faceoff responsibility is not poor performance.
                                Overall, PP and SH percentages are context,
                                without extra scoring weight. No overall-player
                                contribution has been assigned.
                            </p>
                        </div>
                    </details>

                    <details className="mt-5 text-xs text-slate-400">
                        <summary className="cursor-pointer text-sky-400">
                            Three-season faceoff history
                        </summary>

                        {seasons.map((season) => (
                            <div
                                key={season.season}
                                className="mt-3 border-b border-slate-700 pb-3"
                            >
                                <div className="flex justify-between gap-3">
                                    <span>{seasonLabel(season.season)}</span>
                                    <strong className="text-sky-300">
                                        {format(season.faceoffRating)} /10
                                    </strong>
                                </div>
                                <p className="mt-2">
                                    {season.totalFaceoffs} total draws
                                </p>

                                {number(season.faceoffRating) === null && (
                                    <p className="mt-2 leading-relaxed text-sky-300">
                                        {combinedGradeExplanation(season)}
                                    </p>
                                )}
                            </div>
                        ))}

                        <p className="mt-3 leading-relaxed">
                            A dash means no combined grade; zero is valid.
                            Historical grades average indices, not these
                            displayed season grades.
                        </p>
                    </details>
                </>
            ) : (
                <p className="mt-4 text-sm text-slate-400">
                    Historical faceoff rating unavailable.
                </p>
            )}

            {player ? (
                <>
                    <h3 className="mt-7 border-t border-slate-700 pt-5 text-[17px] font-semibold">
                        {seasonLabel(player.season)} recorded faceoffs
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">
                        {player.gamesPlayed} games · {player.totalFaceoffs} draws
                        {" · "}{format(player.faceoffsPerGame)} draws/game
                    </p>
                    <div className="mt-4 rounded-lg border border-slate-700 bg-[#080f1c] p-4">
                        {number(score?.faceoffRating) !== null ? (
                            <p className="text-sm font-semibold text-sky-300">
                                Season combined grade:{" "}
                                {format(score.faceoffRating)} /10
                            </p>
                        ) : (
                            <>
                                <p className="text-sm leading-relaxed text-sky-300">
                                    {combinedGradeExplanation(player)}
                                </p>
                                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                                    Recorded statistics remain visible below.
                                    Individual comparisons appear wherever
                                    their own qualification requirements are met.
                                </p>
                            </>
                        )}
                    </div>

                    <FaceoffComparison
                        player={player}
                        baselines={baselines}
                        metric="overallFaceoffWinPct"
                        label="Overall faceoffs"
                        attempts="totalFaceoffs"
                        wins="totalFaceoffWins"
                        status={player.overallSampleStatus}
                        note={`Requires ${rules.minimumOverallDraws} overall draws. Summary context; no additional index weight.`}
                    />

                    {ZONES.map(([zone, label, weight]) => (
                        <FaceoffComparison
                            key={zone}
                            player={player}
                            baselines={baselines}
                            metric={`${zone}FaceoffWinPct`}
                            label={label}
                            attempts={`${zone}Faceoffs`}
                            wins={`${zone}FaceoffWins`}
                            status={player[`${zone}SampleStatus`]}
                            note={`Requires ${rules.minimumOverallDraws} overall draws and ${rules.minimumZoneDraws} in this zone. Weight: ${weight} of a complete combined index.`}
                        />
                    ))}

                    <h3 className="mt-7 border-t border-slate-700 pt-5 text-[17px] font-semibold">
                        Special-teams faceoff context
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        PP: {format(player.powerPlayMinutes)} minutes
                        {" · "}SH: {format(player.shortHandedMinutes)} minutes.
                        These are strength splits, not zone-and-strength intersections.
                    </p>

                    <FaceoffComparison
                        player={player}
                        baselines={baselines}
                        metric="powerPlayFaceoffWinPct"
                        label="Power-play faceoffs"
                        attempts="ppFaceoffs"
                        wins="ppFaceoffsWon"
                        status={player.powerPlaySampleStatus}
                        note={contextNote}
                    />
                    <FaceoffComparison
                        player={player}
                        baselines={baselines}
                        metric="shortHandedFaceoffWinPct"
                        label="Shorthanded faceoffs"
                        attempts="shFaceoffs"
                        wins="shFaceoffsWon"
                        status={player.shortHandedSampleStatus}
                        note={contextNote}
                    />

                    <details className="mt-6 border-t border-slate-700 pt-5 text-xs text-slate-400">
                        <summary className="cursor-pointer text-sm text-sky-400">
                            Score calculation details
                        </summary>
                        <dl className="mt-4 space-y-3">
                            {ZONES.map(([zone, label]) => (
                                <div
                                    key={zone}
                                    className="flex justify-between gap-3"
                                >
                                    <dt>{label} index contribution</dt>
                                    <dd className="font-semibold text-sky-300 tabular-nums">
                                        {format(
                                            score?.[`${zone}FaceoffWinPctContribution`],
                                            3
                                        )}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mt-4 leading-relaxed">
                            Contributions sum to the season index, not the
                            displayed 0–10 grade. Incomplete profiles receive
                            no partial index, while independently qualifying
                            zone comparisons remain available.
                        </p>
                    </details>
                </>
            ) : (
                <p className="mt-6 text-sm text-slate-400">
                    Latest-season faceoff statistics are unavailable.
                </p>
            )}
        </section>
    );
}