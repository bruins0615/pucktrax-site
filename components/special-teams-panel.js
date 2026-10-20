import PowerPlayTeamComparison from "./power-play-team-comparison";
import modelConfig from "../config/model-config";

function number(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function perGame(total, games) {
    const value = number(total);
    const count = number(games);

    return value !== null && count > 0
        ? (value / count).toFixed(3)
        : "—";
}

function timePerGame(seconds, games) {
    const total = number(seconds);
    const count = number(games);

    if (total === null || !(count > 0)) {
        return "—";
    }

    const rounded = Math.round(total / count);
    const minutes = Math.floor(rounded / 60);
    const remainder = String(rounded % 60).padStart(2, "0");

    return `${minutes}:${remainder}`;
}

function Stat({ label, value }) {
    return (
        <div>
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-2 text-[27px] font-semibold tabular-nums">
                {value == null || value === "" ? "—" : value}
            </dd>
        </div>
    );
}

function Opportunity({ seconds, minimum, situation }) {
    const total = number(seconds);
    const minutes = total === null || total < 0
        ? null
        : total / 60;

    const status =
        minutes === null
            ? "Opportunity unavailable"
            : minutes === 0
                ? "No opportunity"
                : minutes >= minimum
                    ? "Eligible sample"
                    : "Limited opportunity";

    return (
        <div className="text-right">
            <p className="rounded bg-sky-400/10 px-2 py-1 text-xs text-sky-300">
                {minutes === null ? "—" : minutes.toFixed(1)}{" "}
                {situation} minutes · {status}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
                Sample minimum: {minimum} minutes
            </p>
        </div>
    );
}

export default function SpecialTeamsPanel({ player, powerPlay, teamContext }) {
    const ppPlayer = powerPlay?.player;
    const shPlayer = teamContext?.player;

    if (!player && !ppPlayer && !shPlayer) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">
                    Special teams
                </h2>
                <p className="mt-3 text-sm text-slate-400">
                    Special-teams statistics are unavailable for this
                    player’s latest recorded season.
                </p>
            </section>
        );
    }

    const seasonRecord = ppPlayer ?? shPlayer ?? player;
    const season =
        `${seasonRecord.season.slice(0, 4)}–` +
        seasonRecord.season.slice(6, 8);

    const ppPoints = ppPlayer
        ? ppPlayer.powerPlayPoints
        : player?.powerPlayPoints;

    const ppGames = ppPlayer
        ? ppPlayer.gamesPlayed
        : player?.gamesPlayed;

    const ppMinutes = number(ppPlayer?.powerPlayMinutes);

    const ppSeconds = ppPlayer
        ? ppMinutes === null
            ? null
            : ppMinutes * 60
        : player?.ppTimeOnIce;

    const hasShData = Boolean(shPlayer || player);

    const shMinutes = number(shPlayer?.shortHandedMinutes);

    const shSeconds = shPlayer
        ? shMinutes === null
            ? null
            : shMinutes * 60
        : player?.shTimeOnIce;

    const shGoals = shPlayer
        ? shPlayer.teamOnIceShortHandedGoals
        : player?.shortHandedGoalsFor;

    const shGames = shPlayer
        ? shPlayer.gamesPlayed
        : player?.gamesPlayed;
    return (
        <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
            <h2 className="text-[19px] font-semibold">
                Special-teams contribution
            </h2>

            <p className="mt-2 text-xs text-slate-400">
                {season} · Individual scoring and team on-ice results
            </p>

            <section className="mt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-[15px] font-semibold">
                        Power play
                    </h3>
                    <Opportunity
                        seconds={ppSeconds}
                        minimum={modelConfig.minimumPowerPlayMinutes}
                        situation="PP"
                    />
                </div>

                <dl className="mt-5 grid gap-6 sm:grid-cols-3">
                    <Stat
                        label="Individual points /game"
                        value={perGame(ppPoints, ppGames)}
                    />
                    <Stat
                        label="Individual PP points"
                        value={ppPoints}
                    />
                    <Stat
                        label="PP time /game"
                        value={timePerGame(ppSeconds, ppGames)}
                    />
                </dl>

                <PowerPlayTeamComparison data={powerPlay} />
            </section>

            <section className="mt-8 border-t border-slate-700 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-[15px] font-semibold">
                        Shorthanded
                    </h3>

                    {hasShData && (
                        <Opportunity
                            seconds={shSeconds}
                            minimum={modelConfig.minimumShortHandedMinutes}
                            situation="SH"
                        />
                    )}
                </div>

                {hasShData ? (
                    <>
                        <dl className="mt-5 grid gap-6 sm:grid-cols-3">
                            <Stat
                                label="Team on-ice goals /game"
                                value={perGame(shGoals, shGames)}
                            />
                            <Stat
                                label="Team on-ice goals"
                                value={shGoals}
                            />
                            <Stat
                                label="SH time /game"
                                value={timePerGame(shSeconds, shGames)}
                            />
                        </dl>

                        <p className="mt-5 text-xs leading-relaxed text-slate-400">
                            Shorthanded scoring is bonus context. It does not
                            currently add to the offensive rating. Recorded
                            production remains visible below the sample minimum.
                        </p>
                    </>
                ) : (
                    <p className="mt-4 text-sm leading-relaxed text-slate-400">
                        Shorthanded statistics are unavailable for this
                        player’s latest recorded season.
                    </p>
                )}
            </section>

            <p className="mt-6 text-xs leading-relaxed text-slate-400">
                Per-game figures use all recorded games played.
                Team figures count goals scored while this player
                was on the ice.
            </p>
        </section>
    );
}