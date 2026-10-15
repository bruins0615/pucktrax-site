# Player sources and shared collection

The collector now separates which players to collect from how their reports are collected.

- `scripts/collectors/collect-contract-players.js`: contract CSV names; preserves the original comparison-player command and last-five-available-seasons behavior, capped at 2025–26.
- `scripts/collectors/collect-bruins.js`: current roster IDs; historical seasons 2023–24, 2024–25, and 2025–26. Historical statistics include previous teams. Goalies excluded.
- `scripts/lib/skater-collector.js`: shared requests, retries, report mappings, core-field completeness, record replacement, and CSV saving.

Run commands from the project root.

## Bruins preview

```sh
node scripts/collectors/collect-bruins.js
```

Default mode fetches and validates the NHL current roster, prints the skaters, and does not write data. On October 15, 2026, that endpoint returned an empty body during verification. The script reports that as an error; it never silently substitutes a different roster.

A separate season-roster preview is available:

```sh
node scripts/collectors/collect-bruins.js --season-roster
```

The explicit 2026–27 roster endpoint returned 21 skaters and two excluded goalies. A season roster is not confirmed to be the active roster. This fallback is preview-only and cannot be combined with collection. Verify active membership before deciding how to handle unavailable current-roster responses.

## Historical Bruins collection

Once the current roster returns valid data and its membership has been reviewed:

```sh
node scripts/collectors/collect-bruins.js --collect
```

This writes `data/bruins-skater-performance.csv`, separate from the comparison-player CSV and its backfills. It does not collect live 2026–27 statistics. A selected player with no NHL appearances in a requested completed season contributes no row for that season; no zero season is invented.

## Core completeness and limitations

Core completion now requires the summary scoring fields, assist splits, summary-shooting denominator, and all eleven five-on-five scoring fields. Numeric zeros count as present. Assist/point totals must reconcile. A missing required core field causes the new season record to be rejected before replacing an existing row.

Some noncore report fields legitimately have historical missingness, so this does not require every cell to be populated. Saved completed seasons are skipped; this is not yet a refresh policy for a live season.

Each save writes a temporary CSV then renames it. Do not run two collectors targeting the same output simultaneously. The shared collector retains the original sequential requests and retry delays. It retrieves the first stats row returned by the NHL, as before; validate full-season traded-player coverage before interpreting records as team-specific results.

This change does not alter the backfill scripts or rewrite existing CSV data. The original collector is backed up as `scripts/test-nhl-player.js.before-shared-collector` during installation.

## Verification

Syntax checked for all three scripts. Mock-response checks covered roster validation, both player sources, the historical-season filter, ten-report collection, resume/skip behavior, replacing an incomplete row without duplication, and preserving the existing row if required core data is missing. No live player-stat collection was run as part of this refactor.

## Ongoing script lifecycle

See [Script maintenance](script-maintenance.md) for permanent collectors, completed migrations, diagnostic scripts, run order, and remaining refactors. See [Offensive Model v1](PuckTrax-offensive-model-v1.md) for the current scoring specification.

The user previewed the season-specific 21-skater Bruins list and confirmed its membership looked expected. The existing script still disallows `--season-roster --collect`; active-roster collection remains a separate capability decision. No claim is made here that Bruins historical collection has completed.
