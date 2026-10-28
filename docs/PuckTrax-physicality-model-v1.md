# PuckTrax Physicality Model — provisional specification

## Purpose

Physicality is an auxiliary contribution based on recorded hitting.
It supplements core offense and defense without penalizing low-hit players.

Hit counts do not establish hit effectiveness, momentum, intimidation
or isolated player value. Overall-value contribution remains undecided.

## Season formula

Hits/game = recorded hits / all games played.

Standardized hit value =
(player hits/game − same-season positional mean)
÷ positional population standard deviation.

Uncapped bonus = 0.025 × max(0, standardized hit value).

Physicality bonus = min(0.25, uncapped bonus).

Average or below-average hitting earns zero, never a deduction.
Preserve both capped and uncapped values for transparency and review.
The bonus is an index amount, not a direct addition to a 0–10 grade.

## Eligibility and baselines

A season requires at least 300 five-on-five minutes, including exactly
300. Use NHL-provided C, L, R and D positions.

Each qualifying player receives equal weight within the same-season
positional baseline. Use population standard deviation.

Hits cover all situations. Five-on-five time determines eligibility;
all recorded games played determine hits/game.

Below-cutoff records retain statistics but receive no calculated bonus.
Missing values remain unavailable; recorded zero is valid.

## Display and interpretation

Show total hits and hits/game prominently.
Hits per 60 all-situations minutes is supporting context only.

Keep calculation components in expandable details. Identify when the
0.25 cap applies. Do not describe uncapped values as additional credit.

Blocks and takeaways already contribute to defense and are not
scored again here. Penalties remain in Discipline.

## Historical contribution to Performance

Average capped season bonuses equally across the player's qualifying
Core seasons. Include qualifying seasons with valid zero bonuses.

Apply the 0.25 cap separately to each season before averaging.
Use only seasons included in the Core history.

Missing or invalid eligible Physicality records are coverage errors,
not assumed zero bonuses.

This historical bonus is approved for addition to the Performance
index. Integration is pending. No second Physicality coefficient
is applied to the saved bonus.

No standalone 0–10 Physicality grade is assigned.

Positive-only refers to the index contribution. A percentile grade
can still fall when other players gain more credit.

Availability remains separate from performance when playing.

## Saved implementation

Reference collection:
`node scripts/collectors/collect-physicality-reference.js`

Saves under `data/league-reference/`:

- `physicality-skaters.csv`
- `physicality-baselines.csv`
- `physicality-metadata.json`

Local calculation, without API requests:
`node scripts/models/calculate-physicality-bonuses.js`

Saves under `data/physicality-bonuses/`:

- `season-physicality-bonuses.csv`
- `model-metadata.json`

The current snapshot contains 2,784 player-seasons:
2,020 eligible bonuses and 764 unscored records.
There are 12 same-season positional baselines.

Preserve standardized hit values, uncapped bonuses, capped bonuses
and the cap-applied flag. Regenerate outputs after coefficient changes;
bonus amounts and cap counts depend on the model version.

The CSV capApplied field is explicitly exported as true or false for
eligible records and blank for unscored records. A true flag means
the uncapped amount strictly exceeds the cap.

Metadata records settings and SHA-256 fingerprints of the exact
reference contents parsed for calculation.

Automated tests cover collection and bonus calculations. Saved bonus
formulas, cap flags, eligibility handling and source fingerprints
were checked. These checks verify implementation, not the empirical
value of the chosen coefficient or cap.

Counts describe the current snapshot, not permanent requirements.
Existing category grades are unchanged.

## Website display

The Physicality tab emphasizes latest-season hits, hits/game and a
same-season positional comparison. Below the eligibility minimum,
recorded statistics remain visible without a comparison bar.

Expandable history shows each season's games, hits, hits/game and
sample status. No combined historical physicality grade is displayed.

Hits/60, capped and uncapped bonuses, and whether the cap reduced
credit appear in collapsed supporting details. Low-hit eligible
players receive zero bonus without a deduction.

## Implementation checklist

- [x] Classify physicality as an auxiliary contribution.
- [x] Choose hits/game as the main measure.
- [x] Set positive-only credit above the positional baseline.
- [x] Choose a provisional 0.025 coefficient and retain the 0.25 cap.
- [x] Compare capped and uncapped results across three seasons.
- [x] Build and test league-wide reference collection.
- [x] Calculate and validate season bonuses.
- [x] Decide historical presentation.
- [x] Add physicality to the player profile.
- [x] Choose equal averaging across qualifying Core seasons.
- [x] Integrate the historical bonus into Performance and verify outputs.
- [ ] Decide how physicality contributes to overall value.