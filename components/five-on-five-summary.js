import modelConfig from "../config/model-config";

function number(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function Stat({ label, value }) {
    return (
        <div>
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-2 text-[29px] font-semibold tracking-tight tabular-nums">
                {value ?? "—"}
            </dd>
        </div>
    );
}

export default function FiveOnFiveSummary({ data }) {
    if (!data) {
        return null;
    }

    const { player } = data;

    const goals = number(player.goals5v5);
    const primary = number(player.primaryAssists5v5);
    const secondary = number(player.secondaryAssists5v5);
    const minutes = number(player.estimatedMinutes5v5);
    const games = number(player.gamesPlayed);

    const points = [goals, primary, secondary].every(
        (value) => value !== null
    )
        ? goals + primary + secondary
        : null;

    const pointsPer60 =
        points !== null && minutes > 0
            ? (points * 60 / minutes).toFixed(3)
            : "—";

    let timePerGame = "—";

    if (minutes !== null && games > 0) {
        const seconds = Math.round(minutes * 60 / games);
        timePerGame =
            `${Math.floor(seconds / 60)}:` +
            String(seconds % 60).padStart(2, "0");
    }

    const season =
        `${player.season.slice(0, 4)}–${player.season.slice(6, 8)}`;

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[15px] font-semibold">
                        Five-on-five production
                    </h2>
                    <p className="text-xs text-slate-400">
                        {season} · Season totals
                    </p>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
                    <Stat label="Goals" value={goals} />
                    <Stat label="Primary assists" value={primary} />
                    <Stat label="Secondary assists" value={secondary} />
                    <Stat label="Points" value={points} />
                </dl>

                <dl className="mt-6 border-t border-slate-700 pt-4">
                    <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-xs text-slate-400">
                            Points per 60 · Derived from totals and estimated minutes
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums">
                            {pointsPer60}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="rounded-xl border border-slate-700 bg-[#101d32] p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[15px] font-semibold">
                        Opportunity &amp; sample
                    </h2>
                    <p className="rounded bg-sky-400/10 px-2 py-1 text-xs text-sky-300">
                        {player.sampleStatus}
                    </p>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-6">
                    <Stat
                        label="Five-on-five time /game"
                        value={timePerGame}
                    />
                    <Stat
                        label="Total five-on-five minutes"
                        value={
                            minutes === null
                                ? null
                                : `≈${minutes.toLocaleString("en-US", {
                                    maximumFractionDigits: 0
                                })}`
                        }
                    />
                </dl>

                <p className="mt-6 border-t border-slate-700 pt-4 text-xs leading-relaxed text-slate-400">
                    Eligibility minimum: {modelConfig.minimumMinutes5v5} minutes.
                    Playing time is estimated from the source report.
                    Recorded totals remain visible for limited samples.
                </p>
            </section>
        </div>
    );
}