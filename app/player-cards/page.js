"use client";

import { useEffect, useMemo, useState } from "react";

const TIMEFRAMES = [
  { value: "last5", label: "Last 5 games" },
  { value: "last10", label: "Last 10 games" },
  { value: "season", label: "This season" },
  { value: "lastseason", label: "Last season" },
];

const TEAMS = ["ANA","BOS","BUF","CAR","CBJ","CGY","CHI","COL","DAL","DET","EDM","FLA","LAK","MIN","MTL","NJD","NSH","NYI","NYR","OTT","PHI","PIT","SEA","SJS","STL","TBL","TOR","UTA","VAN","VGK","WSH","WPG"]; // MVP list; tweak later
const STAT_OPTIONS = [
  { value: "shots", label: "Shots" },
  { value: "goals", label: "Goals" },
  { value: "assists", label: "Assists" },
  { value: "points", label: "Points" },
  { value: "plusMinus", label: "+/-" },
  { value: "pim", label: "PIM" },
  { value: "toi", label: "Time on Ice" },

  // Skater-specific advanced scoring
  { value: "powerPlayGoals", label: "Power Play Goals" },
  { value: "powerPlayPoints", label: "Power Play Points" },
  { value: "gameWinningGoals", label: "Game Winning Goals" },
  { value: "otGoals", label: "OT Goals" },
  { value: "shorthandedGoals", label: "Short-Handed Goals" },
  { value: "shorthandedPoints", label: "Short-Handed Points" },
  { value: "shifts", label: "Shifts" },

  // Goalie stats
  { value: "gamesStarted", label: "Games Started" },
  { value: "shotsAgainst", label: "Shots Against" },
  { value: "goalsAgainst", label: "Goals Against" },
  { value: "savePctg", label: "Save %" },
  { value: "shutouts", label: "Shutouts" },
];

const STAT_LABELS = {
  shots: "Shots",
  goals: "Goals",
  assists: "Assists",
  points: "Points",
  plusMinus: "Plus/Minus",
  pim: "Penalty Minutes",
  toi: "Time on Ice",

  powerPlayGoals: "Power Play Goals",
  powerPlayPoints: "Power Play Points",
  gameWinningGoals: "Game Winning Goals",
  otGoals: "OT Goals",
  shorthandedGoals: "Short-Handed Goals",
  shorthandedPoints: "Short-Handed Points",
  shifts: "Shifts",

  gamesStarted: "Games Started",
  shotsAgainst: "Shots Against",
  goalsAgainst: "Goals Against",
  savePctg: "Save Percentage",
  shutouts: "Shutouts",
};

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function formatStatPhrase(stat, value) {
  const label = STAT_LABELS[stat] || stat;

  if (value === 1) {
    if (label.endsWith("s")) {
      return `${value} ${label.slice(0, -1)}`;
    }
    return `${value} ${label}`;
  }

  return `${value} ${label}`;
}

function joinPhrasesNaturally(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export default function PlayerCards() {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const [timeframe, setTimeframe] = useState("last10");
  const [opponent, setOpponent] = useState("");
  const [stats, setStats] = useState(["shots"]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const answerStatPhrases = Object.entries(result?.summary?.totals || {}).map(
  ([stat, value]) => formatStatPhrase(stat, value));

  // search
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError("");
      if (debounced.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      const r = await fetch(`/api/nhl/search?q=${encodeURIComponent(debounced.trim())}`);
      const data = await r.json();
      if (!cancelled) setSearchResults(data.players || []);
    }
    run().catch(() => {});
    return () => { cancelled = true; };
  }, [debounced]);

  const selectedStatsLabels = useMemo(() => {
    const map = new Map(STAT_OPTIONS.map(s => [s.value, s.label]));
    return stats.map(s => map.get(s) || s).join(", ");
  }, [stats]);

  async function runQuery() {
    if (!selectedPlayer?.id) {
      setError("Pick a player first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/nhl/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          timeframe,
          opponent: opponent || "",
          stats,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Query failed");
      setResult(data);
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function toggleStat(s) {
    setStats(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  return (
    <main className="min-h-screen bg-sky-100 px-6 py-10">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-black">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Player Cards</h1>
      <p className="text-gray-700 mb-8">Last N games overall → optional opponent filter → totals + game list.</p>

      {/* Player search */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Player</label>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedPlayer(null); }}
          placeholder='Type "Pavel Zacha"…'
          className="w-full border border-gray-300 bg-white rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        {searchResults.length > 0 && !selectedPlayer && (
          <div className="border rounded-lg mt-2 overflow-hidden">
            {searchResults.slice(0, 8).map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPlayer(p); setQuery(p.name); setSearchResults([]); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50"
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-500">{p.team} {p.position ? `• ${p.position}` : ""}</div>
              </button>
            ))}
          </div>
        )}
        {selectedPlayer && (
          <div className="text-sm text-gray-600 mt-2">
            Selected: <span className="font-semibold">{selectedPlayer.name}</span> ({selectedPlayer.team} {selectedPlayer.position})
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Timeframe</label>
          <select className="w-full border border-gray-300 bg-white rounded-lg px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            {TIMEFRAMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Opponent (optional)</label>
          <select className="w-full border border-gray-300 bg-white rounded-lg px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400" value={opponent} onChange={(e) => setOpponent(e.target.value)}>
            <option value="">Any team</option>
            {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Run</label>
          <button
            onClick={runQuery}
            disabled={loading}
            className="w-full rounded-lg bg-black text-white py-3 hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? "Running…" : "Run query"}
          </button>
        </div>
      </div>

      {/* Stat multi-select */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">Stats</label>
        <div className="flex flex-wrap gap-2">
          {STAT_OPTIONS.map(s => (
            <button
              key={s.value}
              onClick={() => toggleStat(s.value)}
              className={`px-4 py-2 rounded-lg border transition ${
  stats.includes(s.value)
    ? "bg-black text-white border-black"
    : "bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200"
}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-sm text-gray-500 mt-2">Selected: {selectedStatsLabels}</div>
      </div>

      {error && <div className="mb-6 text-red-600">{error}</div>}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <div className="border rounded-xl p-5">
            <div className="font-semibold mb-1">{result.player?.name}</div>
            <div className="text-sm text-gray-600 mb-4">
              Games matched: {result.summary?.games} {result.filters?.opponent ? `• vs ${result.filters.opponent}` : ""}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(result.summary?.totals || {}).map(([k, v]) => (
                <div key={k} className="border rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase">{STAT_LABELS[k] ||k}</div>
                  <div className="text-2xl font-bold">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
  <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase mb-2">
    Answer
  </div>

  <div className="text-lg font-semibold text-black leading-snug">
    {(result.player?.name || selectedPlayer?.name || "This player")} recorded{" "}
<span className="font-bold">
  {joinPhrasesNaturally(answerStatPhrases)}
</span>{" "}
over <span className="font-bold">{result.summary?.games}</span>{" "}
{result.filters?.timeframe === "last5"
  ? "games (last 5)"
  : result.filters?.timeframe === "last10"
  ? "games (last 10)"
  : result.filters?.timeframe === "season"
  ? "games (this season)"
  : "games (last season)"}{" "}
{result.filters?.opponent ? (
  <>
    vs <span className="font-bold">{result.filters.opponent}</span>
  </>
) : (
  <>vs any opponent</>
)}
  </div>
</div>
          <div className="border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">Games</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Opp</th>
                    {stats.map(s => <th key={s} className="text-left px-4 py-3">{STAT_LABELS[s] || s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(result.games || []).map((g, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-3">{g.date || "-"}</td>
                      <td className="px-4 py-3">{g.opponent || "-"}</td>
                      {stats.map(s => <td key={s} className="px-4 py-3">{g.stats?.[s] ?? 0}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
      </div>
    </main>
  );
}