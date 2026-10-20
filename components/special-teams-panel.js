import PowerPlayTeamComparison from "./power-play-team-comparison";

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

export default function SpecialTeamsPanel({ player, powerPlay }) {
    if (!player) {
        return (
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <h2 className="text-[19px] font-semibold">
                    Special teams
                </h2>
                <p className="mt-3 text-sm text-slate-400">
                    Detailed special-teams statistics are unavailable
                    for this player’s latest recorded season.
                </p>
            </section>
        );
    }

    const season =
        `${player.season.slice(0, 4)}–${player.season.slice(6, 8)}`;

    return (
        <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
            <h2 className="text-[19px] font-semibold">
                Special-teams contribution
            </h2>

            <p className="mt-2 text-xs text-slate-400">
                {season} · Individual scoring and team on-ice results
            </p>

            <section className="mt-6">
                <h3 className="text-[15px] font-semibold">Power play</h3>

                <dl className="mt-5 grid gap-6 sm:grid-cols-3">
                    <Stat
                        label="Individual points /game"
                        value={perGame(player.powerPlayPoints, player.gamesPlayed)}
                    />
                    <Stat
                        label="Individual PP points"
                        value={player.powerPlayPoints}
                    />
                    <Stat
                        label="PP time /game"
                        value={timePerGame(player.ppTimeOnIce, player.gamesPlayed)}
                    />
                </dl>

                <PowerPlayTeamComparison data={powerPlay} />
            </section>

            <section className="mt-8 border-t border-slate-700 pt-6">
                <h3 className="text-[15px] font-semibold">Shorthanded</h3>

                <dl className="mt-5 grid gap-6 sm:grid-cols-3">
                    <Stat
                        label="Team on-ice goals /game"
                        value={perGame(player.shortHandedGoalsFor, player.gamesPlayed)}
                    />
                    <Stat
                        label="Team on-ice goals"
                        value={player.shortHandedGoalsFor}
                    />
                    <Stat
                        label="SH time /game"
                        value={timePerGame(player.shTimeOnIce, player.gamesPlayed)}
                    />
                </dl>

                <p className="mt-5 text-xs leading-relaxed text-slate-400">
                    Shorthanded scoring is bonus context. It does not
                    currently add to the offensive rating.
                </p>
            </section>

            <p className="mt-6 text-xs leading-relaxed text-slate-400">
                Per-game figures use all recorded games played.
                Team figures count goals scored while this player
                was on the ice.
            </p>
        </section>
    );
}