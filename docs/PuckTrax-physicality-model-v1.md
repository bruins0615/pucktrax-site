# PuckTrax Physicality Model v1 — provisional specification

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

Uncapped bonus = 0.10 × max(0, standardized hit value).

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

## Open decisions

Historical aggregation and any standalone grade remain undecided.
A high hitting rank must not be presented as high overall player value.
Availability and durability remain a separate investigation.

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

Among eligible records, 823 receive positive bonuses and 1,197 receive
zero. The cap reduces 44 bonuses. Preserve standardized hit values,
uncapped bonuses, capped bonuses and the cap-applied flag.

The CSV capApplied field is explicitly exported as true or false for
eligible records and blank for unscored records. A true flag means
the uncapped amount strictly exceeds the cap.

Metadata records settings and SHA-256 fingerprints of the exact
reference contents parsed for calculation.

Sixty-four automated tests pass across the project. Saved bonus
formulas, cap flags, eligibility handling and source fingerprints
were checked. These checks verify implementation, not the empirical
value of the chosen coefficient or cap.

Counts describe the current snapshot, not permanent requirements.
Existing category grades are unchanged.

## Implementation checklist

- [x] Classify physicality as an auxiliary contribution.
- [x] Choose hits/game as the main measure.
- [x] Set positive-only credit above the positional baseline.
- [x] Choose a 0.10 coefficient and 0.25 cap.
- [x] Compare capped and uncapped results across three seasons.
- [x] Build and test league-wide reference collection.
- [x] Calculate and validate season bonuses.
- [ ] Decide historical presentation.
- [ ] Add physicality to the player profile.
- [ ] Decide how physicality contributes to overall value.