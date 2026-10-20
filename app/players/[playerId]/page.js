import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerRatings } from "../../../lib/player-data";
import FiveOnFivePanel from "../../../components/five-on-five-panel";

function seasonLabel(season) {
    return `${season.slice(0, 4)}–${season.slice(6, 8)}`;
}

function formatRating(value) {
    return value == null || value === ""
        ? "—"
        : Number(value).toFixed(1);
}

function formatMinutes(value) {
    return value == null || value === ""
        ? "—"
        : Number(value).toLocaleString("en-US", {
            maximumFractionDigits: 0
        });
}

function Stat({ label, value }) {
    const displayValue =
        value == null || value === ""
            ? "—"
            : label === "Plus/minus" && Number(value) > 0
                ? `+${value}`
                : value;

    return (
        <div className="rounded-xl border border-slate-700 bg-[#080f1c] p-4">
            <dt className="text-xs font-medium text-slate-400">
                {label}
            </dt>
            <dd className="mt-2 text-2xl font-bold tabular-nums">
                {displayValue}
            </dd>
        </div>
    );
}

export default async function PlayerPage({ params }) {
    const { playerId } = await params;
    const data = getPlayerRatings(playerId);

    if (!data) {
        notFound();
    }

    const { historical, seasons, coreStats, fiveOnFive } = data;
    const hasRating =
        historical.offenseRating != null &&
        historical.offenseRating !== "";

    const positionNames = {
        C: "Center",
        L: "Left wing",
        R: "Right wing",
        D: "Defenseman"
    };

    const historicalWindow =
        `${historical.windowStart.slice(0, 4)}–` +
        historical.windowEnd.slice(6, 8);

    return (
        <main className="min-h-screen bg-[#080f1c] px-4 py-6 text-white sm:px-8">
            <div className="mx-auto max-w-6xl">
                <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <Link href="/" aria-label="PuckTrax home">
                        <Image
                            src="/pucktraxlogo-transparent.png"
                            alt="PuckTrax"
                            width={180}
                            height={180}
                            className="h-20 w-auto object-contain"
                            priority
                        />
                    </Link>

                    <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
                        The game beneath the surface
                    </p>
                </header>

                <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <aside
                        aria-label="Player identity and offensive rating"
                        className="rounded-2xl border border-slate-700 bg-[#101d32] p-6"
                    >
                        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
                            Player profile
                        </p>

                        <h1 className="mt-3 text-3xl font-bold">
                            {historical.player}
                        </h1>

                        <p className="mt-2 text-sm text-slate-400">
                            {positionNames[historical.position] ??
                                historical.position}
                        </p>

                        <section
                            aria-labelledby="offense-heading"
                            className="mt-6 border-t border-slate-700 pt-6"
                        >
                            <h2
                                id="offense-heading"
                                className="text-sm font-semibold"
                            >
                                Historical offensive rating
                            </h2>

                            <div
                                aria-label={`Offensive rating: ${hasRating
                                    ? `${formatRating(historical.offenseRating)} out of 10`
                                    : "unrated"
                                    }`}
                                className="mt-4 flex h-24 w-24 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-400/10 text-[35px] font-bold tabular-nums"
                            >
                                {formatRating(historical.offenseRating)}
                            </div>

                            <p className="mt-4 text-lg font-semibold">
                                {hasRating
                                    ? `Percentile rank: ${Number(
                                        historical.percentile
                                    ).toFixed(1)}`
                                    : "No eligible historical rating"}
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                                Among NHL positional peers
                            </p>

                            <p className="mt-3 text-sm text-slate-400">
                                {historicalWindow} ·{" "}
                                {historical.eligibleSeasons} eligible{" "}
                                {Number(historical.eligibleSeasons) === 1
                                    ? "season"
                                    : "seasons"}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                                Provisional offense model
                            </p>

                            <details className="mt-5 border-t border-slate-700 pt-4">
                                <summary className="cursor-pointer text-sm font-semibold text-sky-400">
                                    About this grade
                                </summary>

                                <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
                                    <p>
                                        Comparison group:{" "}
                                        <strong className="text-white">
                                            {historical.comparisonGroupSize || "—"} players
                                        </strong>{" "}
                                        with the same latest recorded NHL position
                                        within this historical window and at least
                                        one eligible season.
                                    </p>

                                    <p>
                                        Eligible season indices receive equal weight.
                                        Their average determines the historical
                                        percentile. The rating is that percentile
                                        divided by 10, rounded to one decimal.
                                    </p>

                                    <p>
                                        Tied scores share a midpoint percentile.
                                        A shorter history provides less evidence
                                        about sustained performance.
                                    </p>

                                    <p>
                                        This describes offense, not overall player
                                        value or future performance. A rounded 10.0
                                        does not mean perfect performance.
                                    </p>
                                </div>
                            </details>
                        </section>

                        <section
                            aria-labelledby="core-stats-heading"
                            className="mt-6 border-t border-slate-700 pt-6"
                        >
                            <h2
                                id="core-stats-heading"
                                className="text-sm font-semibold"
                            >
                                {coreStats
                                    ? `${seasonLabel(coreStats.season)} regular season`
                                    : "Regular-season statistics"}
                            </h2>

                            {coreStats ? (
                                <>
                                    <p className="mt-2 text-sm text-slate-400">
                                        {coreStats.teams}
                                    </p>

                                    <dl className="mt-4 grid grid-cols-2 gap-3">
                                        <Stat label="Games" value={coreStats.gamesPlayed} />
                                        <Stat label="Goals" value={coreStats.goals} />
                                        <Stat label="Assists" value={coreStats.assists} />
                                        <Stat label="Points" value={coreStats.points} />
                                        <Stat label="Plus/minus" value={coreStats.plusMinus} />
                                    </dl>
                                </>
                            ) : (
                                <p className="mt-3 text-sm text-slate-400">
                                    Detailed statistics are unavailable for this
                                    player’s latest recorded season.
                                </p>
                            )}
                        </section>
                    </aside>

                    <div className="min-w-0 space-y-6">
                        <FiveOnFivePanel data={fiveOnFive} />
                        <section
                            aria-labelledby="history-heading"
                            className="rounded-2xl border border-slate-700 bg-[#101d32] p-5 sm:p-6"
                        >
                            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
                                Offensive performance
                            </p>

                            <h2
                                id="history-heading"
                                className="mt-2 text-xl font-semibold"
                            >
                                Three-season history
                            </h2>

                            <p className="mt-3 text-sm leading-relaxed text-slate-400">
                                Each season’s rating compares eligible players
                                at the same NHL position in that season. The
                                historical grade uses the underlying indices,
                                rather than averaging these displayed ratings.
                            </p>

                            <div className="mt-5 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <caption className="sr-only">
                                        Offensive ratings and recorded playing time
                                        by season
                                    </caption>

                                    <thead className="border-b border-slate-700 text-slate-400">
                                        <tr>
                                            <th scope="col" className="py-3 pr-4">
                                                Season
                                            </th>
                                            <th scope="col" className="py-3 pr-4 text-right">
                                                Rating
                                            </th>
                                            <th scope="col" className="py-3 pr-4 text-right">
                                                Games
                                            </th>
                                            <th scope="col" className="py-3 text-right">
                                                5v5 min
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {seasons.map((season) => (
                                            <tr
                                                key={season.season}
                                                className="border-b border-slate-800 last:border-0"
                                            >
                                                <th
                                                    scope="row"
                                                    className="whitespace-nowrap py-4 pr-4 font-medium"
                                                >
                                                    {seasonLabel(season.season)}
                                                </th>

                                                <td className="py-4 pr-4 text-right text-xl font-bold text-sky-300 tabular-nums">
                                                    {formatRating(season.offenseRating)}
                                                </td>

                                                <td className="py-4 pr-4 text-right tabular-nums">
                                                    {season.gamesPlayed}
                                                </td>

                                                <td className="py-4 text-right tabular-nums">
                                                    {formatMinutes(
                                                        season.estimatedMinutes5v5
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <p className="mt-4 text-xs leading-relaxed text-slate-400">
                                Five-on-five minutes are estimated from the source
                                report. A dash indicates an unrated season;
                                zero is a valid rating.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}