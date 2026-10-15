# PuckTrax Offensive Model v1 — provisional specification

This specification records the subsequent scoring decisions made after the initial offensive-methodology inventory. It supersedes that inventory's open questions about five-on-five inputs, weights, team-context scoring, and the PP addition. It defines a descriptive offensive index, not projected talent, contract value, or overall player value.

## Season score

For each season, calculate positional z-scores for individual five-on-five rates among NHL skaters with at least 150 five-on-five minutes. Keep the NHL-provided C, L, R, and D positions.

```text
Z(metric) = (player rate − same-season positional mean)
            / same-season positional population standard deviation

Five-on-five score = 0.54 × Z(goals/60)
                   + 0.27 × Z(primary assists/60)
                   + 0.09 × Z(secondary assists/60)
                   + 0.10 × Z(individual shots on goal/60)

PP addition = individual PP points / games played

Season offensive index = five-on-five score + PP addition
```

The coefficients derive from 90% scoring production and 10% shot generation; production is divided 60% goals, 30% primary assists, and 10% secondary assists. These are provisional model choices, not empirically estimated values or guaranteed shares of score variance.

The PP coefficient is 1. Equal PP points/game earns equal credit across positions. Any recorded PP production earns positive credit; zero earns zero. Positional PP baselines are display context and are not subtracted from the addition. The 75-minute PP threshold labels sample support; it does not remove credit for production below that threshold.

The combined index is not itself a z-score. Zero is not the combined league average. Its five-on-five component is relative to position, so cross-position differences should not be interpreted as absolute hockey value.

## Eligibility, missingness, and exposure

- The combined trial index is calculated only for player-seasons meeting the 150-minute five-on-five minimum with valid core inputs and PP points/game.
- Retain below-threshold seasons and their recorded production in the data, but do not substitute zero for an unavailable index.
- Retain observed qualifying scores without regression, shrinkage, or sample-size penalties.
- Show games played, total five-on-five minutes, time/game, and eligible historical season count beside results.
- A supplemental “qualifying, short sample” label is supported in principle, but its numerical boundary has not been agreed. Do not invent one.
- Eligibility is not proof of reliability. Casey's 2024–25 sample is approximately 157 five-on-five minutes in 14 games and remains qualifying without adjustment.
- Keep missing production, zero production, and no playing opportunity distinct.
- No manual prospect, age, reputation, or player-specific exceptions affect the descriptive score.

## Historical aggregation and outputs

Overall Performance's offensive component uses the equal-weight average of available eligible season indices within the three most recent completed seasons. There is no recency bonus or exposure weighting between eligible seasons. Show the number of eligible seasons; do not backfill an ineligible recent season with a fourth older season without a new decision.

For a live 2026–27 season, the completed-season window is 2023–24, 2024–25, and 2025–26. Current Trend is intended to use live 2026–27 results separately. Current Trend remains unavailable until collection and matching current-season reference baselines exist; historical baselines are not silently substituted.

Projected Performance is deferred. The historical index is descriptive and does not predict development or decline.

## Context outside the numerical score

- Team on-ice five-on-five unblocked attempts/60 and even-strength goals for/60, with same-season positional comparisons.
- Team on-ice PP goals/game and SH goals/game, plus situation-specific time/game.
- SH scoring remains bonus context with no numerical addition yet and no penalty for zero scoring. Its meaningful-usage flag is 75 SH minutes.
- Shooting percentage, broader EV totals and rates, all-situations totals, plus/minus, and deployment measures.
- Points and total assists summarize component production; do not add them again as independent credit.

Team on-ice results are not adjusted for teammates, opponents, or deployment and do not receive independent score weight. Qualitative player-style descriptors require their own methodology, particularly when referring to defensive or two-way ability.

## Reference inputs and verification performed

Repository reference directory: `/Users/andrewvayo/dev/pucktrax-site/data/league-reference/`.

- `skaters.csv` and `baselines.csv`: five-on-five inputs and positional baselines.
- `powerplay-skaters.csv` and `powerplay-baselines.csv`: individual PP production, exposure, and display baselines.
- `team-context-skaters.csv` and `team-context-baselines.csv`: team-context comparisons.

Read-only calculations successfully produced trial combined indices for 2,225 eligible player-seasons across the three completed seasons. Reviewed named examples, changing roles/results, and short qualifying samples. This verifies calculation behavior, not predictive accuracy or final model validity.

A reusable scoring script and saved offensive ratings now exist; see the implementation section below. No overall player grade or published player-profile website implementation exists.

## Percentile ratings — agreed implementation

Season percentiles compare unrounded offensive indices among eligible skaters in the same season and NHL position. Use the midpoint of tied ranks:

```text
Percentile = 100 × (players below + 0.5 × players tied) / eligible group size
Offense rating = percentile / 10, rounded to one decimal
```

This is a relative offensive rating, not an overall player grade. Five is approximately median. A displayed 10.0 can result from rounding and does not indicate perfection. Small rating differences may reflect rounding; retain unrounded indices and percentiles in outputs.

Historical ratings first average unrounded eligible season indices equally within the three-year window, then calculate a percentile among players with at least one eligible season, grouped by the NHL position in their latest recorded season in that window. One-, two-, and three-season histories share the comparison pool. Do not average season percentiles or displayed ratings.

Retain players with no eligible history. Their index, percentile, comparison size, and rating are blank/unavailable, not zero. Recorded zero scoring remains zero. The historical export contains both recorded games/minutes across all available seasons and games/minutes from eligible seasons, plus available/eligible season counts and included season IDs.

No regression or reliability adjustment is applied. Exposure and historical coverage must be prominent. A supplemental qualifying-short-sample label still has no agreed numeric boundary.

## Saved implementation and outputs

The user built `scripts/models/calculate-offensive-ratings.js` with guided edits. It reads local league-reference CSVs without API calls and saves:

- `data/offensive-ratings/season-offensive-ratings.csv`: all 2,784 player-season rows, including 2,225 scored records and 559 unscored rows.
- `data/offensive-ratings/historical-offensive-ratings.csv`: 1,196 players, including 957 rated and 239 without eligible history.
- `data/offensive-ratings/model-metadata.json`: weights, coefficient, seasons, thresholds, grouping, percentile method, and output counts.

Counts describe the current reference snapshot, not permanent expected totals. Season outputs retain each metric's z-score and weighted contribution, five-on-five score, PP addition, and combined index. Historical outputs retain averaged five-on-five and PP components. Saved numeric indices and percentiles are not rounded for display; ratings are rounded to one decimal.

Syntax, isolated end-to-end output writing, component sums, eligible-only season percentiles, historical averaging, historical percentiles, and saved output counts were checked. Source data was not changed by scoring. This is calculation verification, not independent validation of the chosen weights.

## Player-profile presentation

Use the Night rink theme and Scout notebook layout. The large grade area is labeled Offense, not overall player value. Keep jersey number in the identity line. Player-style descriptors remain unassigned until separately defined.

The current demo shows 2025–26 statistics and its matching season Offense rating. A separately labeled historical summary can show 2023–24 through 2025–26 ratings with the eligible-season count. Do not show a historical grade as though it describes a single selected season.

Display games played, totals, plus/minus, and usage as context. Show actual per-60 rates prominently, positional averages secondarily, and plain-language comparison labels. Standardized detail is expandable. Team context stays unweighted and clearly distinguishes 5v5 from EV coverage. Current Trend and projected output remain unimplemented.

## Remaining work

- Define the optional short-qualifying-sample label consistently, or rely on numeric exposure alone.
- Continue validation across players, sample sizes, and seasons before finalizing model version or presenting ratings as established measures of value.
- Add source fingerprints or an explicit reference snapshot ID for stronger reproducibility in a future iteration.
- Develop defensive and other categories before an overall player grade or two-way style descriptor.
- Implement the actual website profile with guided user edits; the conversation mockup is not project website code.
