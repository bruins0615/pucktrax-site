function number(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

const ACTIONS = [
    {
        label: "Blocked shots",
        count: "individualBlockedShotsAllSituations",
        rate: "individualBlockedShotsPer60AllSituations",
        bonus: "blockBonus"
    },
    {
        label: "Takeaways",
        count: "individualTakeawaysAllSituations",
        rate: "individualTakeawaysPer60AllSituations",
        bonus: "takeawayBonus"
    }
];

export default function DefensiveActions({ player, score }) {
    const matchingScore =
        score?.season === player.season &&
            score?.playerId === player.playerId
            ? score
            : null;

    return (
        <section className="mt-6">
            <h3 className="text-[17px] font-semibold">
                Individual defensive actions
            </h3>
            <p className="mt-2 text-xs text-slate-400">
                All situations · Rates use total ice time
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {ACTIONS.map((action) => {
                    const count = number(player[action.count]);
                    const rate = number(player[action.rate]);
                    const bonus = number(matchingScore?.[action.bonus]);

                    return (
                        <section
                            key={action.bonus}
                            className="rounded-xl border border-slate-700 bg-[#080f1c] p-4"
                        >
                            <h4 className="text-sm font-semibold">
                                {action.label}
                            </h4>

                            <dl className="mt-4 space-y-4">
                                <div>
                                    <dt className="text-xs text-slate-400">
                                        Per 60 all-situations minutes
                                    </dt>
                                    <dd className="mt-1 text-[27px] font-semibold tabular-nums">
                                        {rate === null ? "—" : rate.toFixed(2)}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-xs text-slate-400">
                                        Recorded total
                                    </dt>
                                    <dd className="font-semibold tabular-nums">
                                        {count === null ? "—" : count}
                                    </dd>
                                </div>
                                <div className="border-t border-slate-700 pt-3">
                                    <dt className="text-xs text-slate-400">
                                        Season index bonus
                                    </dt>
                                    <dd className="mt-1 text-xl font-bold text-sky-300 tabular-nums">
                                        {bonus === null
                                            ? "—"
                                            : `+${bonus.toFixed(3)}`}
                                    </dd>
                                </div>
                            </dl>
                        </section>
                    );
                })}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-400">
                These are positive additions to the season index, not
                points added directly to the displayed 0–10 grade.
                Zero actions earn zero bonus. Below the five-on-five
                eligibility minimum, no bonus-only score is awarded.
            </p>
        </section>
    );
}