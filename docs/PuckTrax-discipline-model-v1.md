# PuckTrax Discipline Model v1 — provisional specification

## Purpose

Describe recorded penalty burden and above-average penalty drawing.
This is a separate category, not an overall player grade or a direct
estimate of power-play opportunities created or conceded.

## Agreed season formula

PIM/game = penalty minutes / all games played.

Penalties drawn/game = penalties drawn / all games played.

Discipline foundation =
(positional mean PIM/game − player PIM/game)
÷ positional population standard deviation.

Drawing value =
(player penalties drawn/game − positional mean)
÷ positional population standard deviation.

Drawing bonus = 0.10 × max(0, drawing value).

Discipline index = discipline foundation + drawing bonus.

Lower PIM/game improves the foundation. Drawing at or below the
positional average earns zero bonus, never a deduction.
The combined index is not itself a z-score.

## Eligibility and baselines

A season requires at least 300 five-on-five minutes, including exactly
300. Each baseline uses eligible players from the same season and
NHL-provided position: C, L, R or D. Players receive equal weight.

Penalty measures cover all situations. Five-on-five minutes determine
eligibility; games played are the denominator for the scoring inputs.

Retain below-cutoff records and recorded statistics without assigning
an index. Missing values remain unavailable; recorded zero is valid.

## Display fields

- Penalty minutes.
- Penalty minutes/game and positional comparison.
- Penalties taken.
- Penalties drawn and penalties drawn/game.
- Net penalties: drawn minus taken.

Net penalties is context only, avoiding another penalty-taking
deduction on top of the PIM/game foundation.

## Interpretation

All penalty types remain included. Penalty minutes and penalties
drawn are not equivalent to power-play opportunities.

Fighting and misconduct can affect these statistics. The model does
not directly measure momentum, teammate protection, intent or whether
an individual penalty was avoidable.

Drawing receives modest positive credit above its positional baseline.
The coefficient is a provisional modeling choice, not an empirically
estimated value. Combining discipline with overall value remains undecided.

## Historical aggregation and grading

Use the configured 2023–24 through 2025–26 window. Average unrounded
eligible season indices equally, then calculate positional percentiles.
Do not average displayed grades or season percentiles.

Historical comparison groups use each player's latest recorded NHL
position within the window. One-, two-, and three-season eligible
histories share the pool; disclose the eligible-season count.

Season percentiles compare eligible indices within season and position.
Ties share a midpoint percentile:

Percentile = 100 × (players below + half the players tied) / group size.

Rating = percentile / 10, rounded to one decimal.

Players without eligible history remain unrated. Zero is a valid grade.
A rounded 10.0 does not mean perfection. A positive index does not
necessarily imply an above-median percentile.

## Saved implementation

Reference collection:

`node scripts/collectors/collect-discipline-reference.js`

Saves under `data/league-reference/`:

- `discipline-skaters.csv`
- `discipline-baselines.csv`
- `discipline-metadata.json`

Local scoring, without API requests:

`node scripts/models/calculate-discipline-ratings.js`

Saves under `data/discipline-ratings/`:

- `season-discipline-indices.csv`
- `historical-discipline-ratings.csv`
- `model-metadata.json`

The current snapshot contains 2,784 player-seasons: 2,020 scored and
764 unscored. Historical output contains 1,196 players: 864 rated
and 332 without eligible history. There are 24 reference baselines.

Model metadata records settings and SHA-256 fingerprints of the exact
input contents parsed for scoring. Shared grading helpers are also
used by offense and defense.

Thirty-seven automated tests pass. Saved component averages,
percentiles, ratings, eligibility handling and fingerprints were checked.
These checks verify implementation, not the empirical validity of
the chosen formula or coefficient.

## Website display

The Discipline tab shows the historical grade, eligible-season count,
explanation, and expandable season history. Latest-season statistics
include PIM, penalties taken, penalties drawn, and net penalties.

PIM/game and penalties drawn/game have positional comparisons.
Below 300 five-on-five minutes, recorded statistics remain visible
but comparison bars and season scores are unavailable.

The foundation and drawing bonus appear in collapsed Score calculation
details. They are index components, not direct additions to the 0–10 grade.

## Implementation checklist

- [x] Choose PIM/game as the foundation.
- [x] Choose a positive-only, above-baseline drawing bonus.
- [x] Set the provisional drawing coefficient to 0.10.
- [x] Collect league-wide references for the historical window.
- [x] Validate inputs and implement season calculations.
- [x] Review results across all three seasons.
- [x] Confirm historical aggregation and grade conversion.
- [x] Build the Discipline tab.
- [ ] Decide how discipline contributes to overall value.