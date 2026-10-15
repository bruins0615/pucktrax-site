# Script lifecycle and maintenance

This inventory describes the scripts as audited, without moving or deleting them. Run all commands from the project root. “Permanent” means an ongoing responsibility, not that the filename or internals cannot change.

## Ongoing tools

| Script | Role | Recommendation |
|---|---|---|
| `skater-collector.js` | Shared detailed API requests, record mappings, completion and saving | Keep as a shared module; do not invoke directly. |
| `collect-contract-players.js` | Select contract-comparison players and call the shared collector | Keep the function |
| `collect-bruins.js` | Preview current Bruins skaters and collect selected historical seasons | Keep. Default is preview-only. Season fallback remains preview-only; do not mistake it for a verified live active list. |
| `collect-league-reference.js` | League-wide 5v5 reference and positional baselines; currently also exports shared helpers | Keep; eventually extract shared helpers into a dedicated library. |
| `collect-team-reference.js` | League-wide team on-ice context and positional baselines | Keep, separate from weighted individual scoring. |
| `collect-powerplay-reference.js` | PP points/game, exposure, and qualifying positional baselines | Keep. PP baselines describe context; the score addition uses raw PP points/game. |
| `calculate-offensive-ratings.js` | Local season scores, historical averages, percentiles, decimal ratings, metadata | Keep; rerun after consistent scoring inputs change. It makes no API requests. |

## Completed migrations and optional diagnostics

| File | Status | Recommendation |
|---|---|---|
| `backfill-summary-shooting.js` | One-time addition of the matching 5v5 ice-time denominator | No longer needed in the routine pipeline for the existing CSV. Retain as migration history or eventually archive after a guided path review. |
| `backfill-scoring-rates.js` | One-time addition of 11 five-on-five scoring fields | Same: completed for all 432 detailed player-seasons. Future detailed collection already includes these fields. |
| `test-nhl-stats.js` | Hardcoded one-player, one-season API probe | Optional developer diagnostic, not an automated test or routine collector. Could become `inspect-nhl-report.js` with arguments. |
| `test-nhl-player.js.before-shared-collector` | Original full collector backup | Recovery/reference only. Do not run it as the current collector. Keep until a suitable version-control checkpoint and explicit cleanup decision. |

Archiving a backfill is not just moving a file: both currently resolve `data/skater-performance.csv` from the working directory. Document invocation and relative imports when reorganizing. Retain data backups until restoration has been considered; no cleanup of data or scripts has been performed.

## Routine workflow

### Reference refresh

Run these individually and confirm successful completion:

```sh
node scripts/collect-league-reference.js
node scripts/collect-powerplay-reference.js
node scripts/collect-team-reference.js
```

The first two provide required scoring inputs. Team context is independent and is not added to the offensive index. Collectors make public NHL requests and may wait or retry. Their outputs are separate files under `data/league-reference/`.

### Rating rebuild

```sh
node scripts/calculate-offensive-ratings.js
```

This reads local reference files and writes the three files under `data/offensive-ratings/`. It does not require recollecting the detailed comparison-player CSV. Rebuilding ratings alone is fast.

The scoring metadata records each of the three scoring input files in `sourceFingerprints`, including its path, SHA-256 hash, and size in bytes. Each fingerprint is calculated from the same contents parsed for scoring.

These fingerprints identify the exact inputs used for a rating rebuild. They do not archive those inputs or automatically detect stale ratings. Verification confirmed all three fingerprints matched their source files, all seven offline tests passed, and both rating CSVs remained unchanged.

### Detailed comparison-player collection

```sh
node scripts/collect-contract-players.js
```

Uses contract names, selected available completed seasons, and `data/skater-performance.csv`. This does not build the league-wide reference or ratings. It skips rows considered complete, so it is not a live-season refresh mechanism.

### Bruins preview

```sh
node scripts/collect-bruins.js
node scripts/collect-bruins.js --season-roster
```

These commands preview alternate roster sources and do not collect statistics. The user confirmed the season-specific list looked expected. The current implementation still rejects `--season-roster --collect`.

```sh
node scripts/collect-bruins.js --collect
```

Collects from a valid current-roster response into the separate Bruins CSV. It will not silently substitute the season roster. Completion of that collection has not been established in this audit.

## Maintenance priorities for guided edits

1. **Centralize seasons and model constants.** The three completed seasons are repeated in four reference/scoring scripts and the Bruins entry point; the shared detailed collector also has a hardcoded latest completed-season cap, and the roster preview specifies 2026–27. Use an explicit shared completed-season configuration, with live Current Trend a separate future mode. Do not silently reinterpret the frozen historical window based on today's date.
2. **Make executable scripts safe to import.** Team/PP/scoring scripts currently call `main()` unconditionally. Add `require.main === module` guards and explicit exports before building a small reusable offline verification suite.
3. **Completed: source fingerprints in scoring metadata.** Each scoring input now has a SHA-256 hash and byte count captured during reading. Automatic stale-input detection remains a possible future improvement.
4. **Improve names and shared helpers.** Rename the contracts entry point and move `fetchReport`, `indexReport`, baseline calculation, and atomic writing to a neutral shared module. Update imports together; preserve old command compatibility while learning.
5. **Harden error reporting.** Detailed request helpers and backfills lack explicit request timeouts; backfills log errors without setting a failed exit code. Detailed collection can report failed player-seasons but finish successfully at the process level. Review these before scheduled unattended collection.
6. **Completed: validate grouped baseline inputs.** Eligible metric values must be finite numbers before calculating means and population standard deviations. Zero remains valid. Invalid values produce an error naming the metric, player ID, season, and position. Nine offline tests pass, including checks for this validation and known baseline statistics.
7. **Add a small regression check.** Cover z-score contributions, PP positive addition, percentile ties, missing versus zero, threshold boundaries, historical averages before percentiles, no eligible history, and recorded-versus-eligible exposure. Use synthetic fixtures and no live requests.
8. **Review roster handling and traded-player coverage.** Keep the distinction between a verified active snapshot and a season roster. The detailed helper selects the first API row; verify any changed query behavior before assuming it aggregates all team stints.

These are proposed maintenance edits, not changes already applied. No weights, thresholds, grades, APIs, or collection behavior were changed during documentation maintenance.

## Verification from this audit

All ten JavaScript files passed `node --check`. That parses syntax without executing collectors. The detailed comparison CSV has no missing cells in the 12 fields targeted by the two completed backfills across its 432 records. This confirms those backfills are not needed for the current snapshot; it does not guarantee that future data or new files require no migration.

No live API collection or destructive cleanup was performed. Existing scoring output verification and isolated tests are documented in the model specification; syntax checking alone is not a substitute for those checks.
