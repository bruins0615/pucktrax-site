import Image from "next/image";
import Link from "next/link";
import PlayerSearch from "../../components/player-search";
import { getPlayerDirectory } from "../../lib/player-data";

export const metadata = {
    title: "Find a player | PuckTrax",
    description: "Explore historical NHL skater profiles with core performance, offensive and defensive ratings."
};

export default function PlayersPage() {
    const players = getPlayerDirectory();

    const first = players[0];
    const window = first
        ? `${first.windowStart.slice(0, 4)}–${first.windowEnd.slice(6, 8)}`
        : null;

    return (
        <main className="min-h-screen bg-[#080f1c] px-4 py-6 text-white sm:px-8">
            <div className="mx-auto max-w-4xl">
                <header className="mb-8 border-b border-slate-800 pb-5">
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
                </header>

                <h1 className="text-3xl font-bold">Find a player</h1>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
                    Explore historical NHL skater profiles with core
                    performance, offensive and defensive ratings.
                    {window ? ` Historical window: ${window}.` : ""}
                    {" "}Players shown appeared during that window;
                    this is not a verified current-roster list.
                </p>

                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    Ratings compare positional peers. Core performance is
                    a provisional combination of offensive and defensive
                    indices, separate from availability and contract value.
                    Unrated means no eligible result is available.
                </p>

                <div className="mt-8">
                    <PlayerSearch players={players} />
                </div>
            </div>
        </main>
    );
}