import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerRatings } from "../../../lib/player-data";
import FiveOnFivePanel from "../../../components/five-on-five-panel";
import PlayerTabs from "../../../components/player-tabs";
import SpecialTeamsPanel from "../../../components/special-teams-panel";
import TeamContextPanel from "../../../components/team-context-panel";
import FiveOnFiveSummary from "../../../components/five-on-five-summary";
import DefensiveRating from "../../../components/defensive-rating";
import DefensivePanel from "../../../components/defensive-panel";

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
        <div className="py-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
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

    const {
        historical,
        seasons,
        defensiveHistorical,
        defensiveSeasons,
        coreStats,
        fiveOnFive,
        teamContext,
        powerPlay
    } = data;

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

                    <Link
                        href="/players"
                        className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-sky-300 hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    >
                        Find a player
                    </Link>
                </header>

                <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside
                        aria-label="Player identity and performance ratings"
                        className="border-t-[3px] border-t-[#67bdec] pt-5 lg:border-r lg:border-r-slate-700 lg:pr-6"
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

                            <div className="flex items-center gap-4">
                                <div
                                    aria-label={`Offensive rating: ${hasRating
                                        ? `${formatRating(historical.offenseRating)} out of 10`
                                        : "unrated"
                                        }`}
                                    className="flex w-[90px] shrink-0 flex-col items-center rounded-xl border border-slate-700 bg-[#17314b] px-3 py-4"
                                >
                                    <h2
                                        id="offense-heading"
                                        className="text-[11px] font-medium uppercase tracking-widest text-slate-400"
                                    >
                                        Offense
                                    </h2>

                                    <p className="mt-1 text-[35px] font-bold leading-tight text-white tabular-nums">
                                        {formatRating(historical.offenseRating)}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                        / 10
                                    </p>
                                </div>

                                <div className="min-w-0 space-y-2 text-xs leading-relaxed">
                                    <p className="font-medium text-white">
                                        {hasRating
                                            ? `${Number(historical.percentile).toFixed(1)}th percentile`
                                            : "Unrated"}
                                    </p>

                                    <p className="text-slate-400">
                                        Among NHL{" "}
                                        {{
                                            C: "centers",
                                            L: "left wings",
                                            R: "right wings",
                                            D: "defensemen"
                                        }[historical.position] ?? historical.position}
                                        {" · "}
                                        {historicalWindow}
                                    </p>

                                    <p className="text-slate-400">
                                        {historical.eligibleSeasons} eligible{" "}
                                        {Number(historical.eligibleSeasons) === 1
                                            ? "season"
                                            : "seasons"}
                                    </p>
                                </div>
                            </div>

                            <p className="mt-3 text-[11px] text-slate-500">
                                Provisional offense model
                            </p>

                            <details className="mt-5 border-t border-slate-700 pt-4">
                                <summary className="cursor-pointer text-sm font-semibold text-sky-400">
                                    About this offensive grade
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

                        <details className="mt-6 border-t border-slate-700 pt-4">
                            <summary className="cursor-pointer text-sm text-slate-400">
                                Three-season offensive history
                            </summary>

                            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                                Season ratings compare eligible players at the same NHL
                                position in that season. The historical grade averages
                                underlying indices, not these displayed ratings.
                            </p>

                            <div className="mt-4">
                                {seasons.map((season) => (
                                    <div
                                        key={season.season}
                                        className="border-b border-slate-800 py-4 last:border-0"
                                    >
                                        <div className="flex items-baseline justify-between gap-3">
                                            <h3 className="text-sm font-semibold">
                                                {seasonLabel(season.season)}
                                            </h3>

                                            <p className="text-xl font-bold text-sky-300 tabular-nums">
                                                {formatRating(season.offenseRating)}
                                                <span className="ml-1 text-xs font-normal text-slate-400">
                                                    /10
                                                </span>
                                            </p>
                                        </div>

                                        <p className="mt-2 text-xs text-slate-400">
                                            {season.percentile === ""
                                                ? "Unrated season"
                                                : `${Number(season.percentile).toFixed(1)}th percentile`}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-400">
                                            {season.gamesPlayed} games · ≈
                                            {formatMinutes(season.estimatedMinutes5v5)} 5v5 min
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                                Minutes are estimated. A dash indicates an unrated
                                season; zero is a valid rating.
                            </p>
                        </details>

                        <DefensiveRating
                            historical={defensiveHistorical}
                            seasons={defensiveSeasons}
                        />

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

                    <div className="min-w-0">
                        <PlayerTabs
                            tabs={[
                                {
                                    key: "five-on-five",
                                    label: "Five-on-five",
                                    content: (
                                        <div className="space-y-6">
                                            <FiveOnFivePanel data={fiveOnFive} />
                                            <FiveOnFiveSummary data={fiveOnFive} />
                                        </div>
                                    )
                                },
                                {
                                    key: "defense",
                                    label: "Defense",
                                    content: (
                                        <DefensivePanel
                                            data={teamContext}
                                            score={defensiveSeasons.find(
                                                (season) => season.season === teamContext?.player.season
                                            )}
                                        />
                                    )
                                },
                                {
                                    key: "special-teams",
                                    label: "Special teams",
                                    content: <SpecialTeamsPanel
                                        player={coreStats}
                                        powerPlay={powerPlay}
                                        teamContext={teamContext}
                                    />
                                },
                                {
                                    key: "team-context",
                                    label: "Team context",
                                    content: <TeamContextPanel data={teamContext} />
                                }
                            ]}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}