# PuckTrax Defensive Model v1 — provisional specification

This model describes recorded defensive performance. It does not project talent or isolate a player’s impact from teammates, goaltending, opponents, or deployment.

## Season formula

For each suppression metric:

```text
Suppression value =
(same-season positional mean − player rate)
÷ same-season positional population standard deviation
```

Lower opposing-event rates therefore produce higher suppression values.

```text
Defensive foundation =
0.70 × standardized five-on-five unblocked attempts against/60
+ 0.30 × standardized even-strength goals against/60

Block bonus = all-situations blocks/60 × 0.05
Takeaway bonus = all-situations takeaways/60 × 0.025

Defensive index = foundation + block bonus + takeaway bonus
```

The coefficients are provisional choices, not empirically estimated values. The index is not itself a z-score, and zero is not its combined positional average.

## Situations and denominators

- Unblocked attempts against use estimated five-on-five minutes reconstructed from the summary-shooting report.
- EV goals against use even-strength minutes from the time-on-ice report.
- Blocks and takeaways use total all-situations minutes from the time-on-ice report.
- These situations remain distinct in labels and metadata.
- Rates equal event counts divided by matching minutes, multiplied by 60.

## Eligibility and missing values

Offensive and defensive season ratings require at least 300 five-on-five minutes, including exactly 300. Below the minimum, recorded statistics and exposure remain visible, but the season receives no index or grade and is excluded from scoring baselines and historical averages. This is a shared minimum-evidence policy, not a guarantee of statistical reliability. Power-play and shorthanded minimums remain 75 minutes.

Below-cutoff seasons retain recorded statistics but receive no defensive index or bonus-only score. Unrated is distinct from zero.

Eligible scores require valid inputs and available same-season positional baselines with positive standard deviations. Missing values must not silently become zeros.

Use NHL-provided C, L, R, and D positions. Each eligible player receives equal weight in the positional baseline.

## Individual-action treatment

Blocks and takeaways provide proportional positive bonuses without subtracting positional averages. Zero production earns zero bonus.

The block coefficient exceeds the takeaway coefficient. Both coefficients currently apply equally across positions.

Hits remain supporting context and do not affect the index. Total shot attempts against remain supporting context rather than an additional weighted suppression measure.

Penalty killing is displayed as context only, with no separate contribution to the v1 defensive rating. The Special Teams tab shows team on-ice opponent PP goals against/game, SH time/game, and a same-season positional comparison among players with at least 75 SH minutes. Goals against/game combines workload and outcomes; it does not isolate PK effectiveness. Existing all-situations block and takeaway bonuses can include PK actions.

## Interpretation and future decisions

On-ice suppression and goal outcomes are shared team results. Blocks can overlap with unblocked-attempt suppression; their additive credit is an explicit modeling choice.

Playing time, games, and sample size must remain visible. Eligibility does not establish statistical reliability.

Historical defensive ratings average unrounded eligible season indices equally within the configured three-season window, then calculate positional percentiles using the same grading helpers as offense. Percentile divided by 10 produces the displayed rating, rounded to one decimal. Players without eligible history remain unrated. Overall-player scoring is not implemented.

## Saved implementation and outputs

Run `node scripts/models/calculate-defensive-ratings.js` to calculate
season and historical ratings from the saved team-context reference files.

Outputs:

- `data/defensive-ratings/season-defensive-indices.csv`
- `data/defensive-ratings/historical-defensive-ratings.csv`
- `data/defensive-ratings/model-metadata.json`

The current snapshot contains 2,784 player-seasons: 2,020 eligible
indices and 764 unscored records. Historical outputs contain 1,196
players: 864 rated and 332 without eligible history.

Outputs preserve exposure, the foundation, individual bonuses,
and season suppression contributions.

Metadata records model settings and SHA-256 fingerprints of both
input files. Twenty-three automated tests pass. Eligibility boundaries,
historical averages, and source fingerprints were verified.

These counts describe the current reference snapshot, not permanent totals.

## Website display

Player cards display separate historical offensive and defensive grades.
Each grade is grouped with its explanation and expandable season history.
Defensive ratings are read from the saved defensive exports by player ID.
Missing or ineligible ratings display a dash and remain distinct from zero.

The main defensive grade covers the configured three-season window.
Season history shows each season's grade, percentile, games, and estimated
five-on-five minutes. The page does not combine offense and defense into
an overall grade.

The Defense tab shows the latest recorded season's five-on-five
unblocked attempts against and even-strength goals against, with
same-season positional averages. Fewer opposing events appear to
the right of each comparison bar. Comparisons are hidden below
300 five-on-five minutes while recorded statistics remain visible.

Individual action cards show all-situations block and takeaway
totals, rates, and saved season-index bonuses. Bonuses are matched
by player and season; they are not direct additions to the displayed
0–10 grade. Below-cutoff bonuses remain unavailable.

## Implementation checklist

- [x] Inventory defensive candidates and limitations.
- [x] Collect league-wide suppression, blocks, and takeaways.
- [x] Build same-season positional baselines.
- [x] Review multiple players and historical seasons.
- [x] Agree on the provisional formula and 300-minute cutoff.
- [x] Record coefficients in shared configuration.
- [x] Implement and test season defensive indices.
- [x] Review calculated contributions across the comparison group.
- [x] Agree on historical aggregation and rating conversion.
- [x] Display historical defensive grades, explanations, and season history on player cards.
- [x] Add the defensive analysis tab.
- [x] Keep PK as display context with no separate v1 rating contribution.
- [ ] Develop overall-player scoring separately.