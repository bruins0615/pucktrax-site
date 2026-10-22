# PuckTrax Faceoff Model v1 — provisional decisions

## Purpose and category

Faceoffs are an auxiliary category. They describe a role-specific
contribution, separate from core offensive and defensive ratings.

Preserve NHL position labels. Evaluate qualifying faceoff takers
regardless of whether they are listed as centers or wingers.

The provisional zone formula and historical grading are defined below.
Overall-value contribution remains undecided.

## Overall eligibility

A player-season qualifies for overall faceoff evaluation with at
least 300 total faceoffs, including exactly 300.

This is a faceoff-attempt requirement, not a five-on-five minute rule.
No additional skating-minute requirement has been agreed.

Players with zero attempts are not applicable.
Players with some attempts below the minimum have a limited sample
and remain unrated. Recorded counts and percentages remain visible.

## Power-play and shorthanded eligibility

Evaluate PP and SH independently.

Each situation requires overall eligibility and either:

- Regular usage: at least 75 minutes AND at least 50 faceoffs
  in that situation.
- Draw-volume exception: at least 100 faceoffs in that situation,
  regardless of minutes.

All thresholds are inclusive.

Assign the regular-usage label when both routes qualify.
Otherwise identify qualification through the draw-volume exception.

The exception recognizes substantial faceoff participation without
assuming the player has a broader special-teams skating role.
It does not establish that the player was deployed only for draws.

Below both routes, retain statistics without a scored comparison.
No qualifying role is distinct from poor performance.

These exceptions apply only to faceoff evaluation. They do not change
existing PP or SH eligibility rules elsewhere in PuckTrax.

## Zone eligibility

Each zone requires overall eligibility of at least 300 total faceoffs
and at least 100 faceoffs in that specific zone. Thresholds are inclusive.

Evaluate defensive, offensive and neutral zones independently.
Below-cutoff zone statistics remain visible without a scored comparison.
A player need not qualify in every zone to qualify overall.

## Candidate measurements

- Overall wins, losses, attempts and win percentage.
- Faceoffs per game as responsibility context.
- Defensive-, offensive- and neutral-zone results.
- Even-strength, power-play and shorthanded results.

Calculate percentages from wins and attempts.
Zero attempts produces an unavailable percentage, not 0%.

## Baseline groups

Pool qualifying faceoff takers across NHL positions while preserving
their recorded position labels.

Calculate separate same-season baselines for overall, defensive-zone,
offensive-zone, neutral-zone, PP and SH results. Each pool includes only
players meeting its eligibility rules. Each qualifying player receives
equal weight.

A future Faceoff specialist descriptor may recognize substantial
responsibility and sustained strong performance. Its criteria remain
undefined. Qualification through the draw-volume exception alone does
not establish specialist performance.

## Data limitations

NHL season faceoff reports provide zone and strength splits separately.
They do not provide their intersections.

Defensive-zone results cannot be labeled defensive-zone PK results.
Offensive-zone results cannot be labeled offensive-zone PP results.

Zone, strength and overall totals overlap. Any combined formula must
address repeated credit for the same faceoffs.

Minimums are provisional inclusion policies, not guarantees of
statistical reliability. Keep attempt counts visible.

## Provisional scoring formula

For each zone:

Zone value =
(player win percentage − same-season qualifying-player mean)
÷ qualifying-player population standard deviation.

Faceoff index =
0.50 × defensive-zone value
+ 0.30 × offensive-zone value
+ 0.20 × neutral-zone value.

A combined index requires at least 300 overall draws and at least
100 draws in each of the three zones. Otherwise the combined score
is incomplete. Do not substitute zero or redistribute missing weights.

Each faceoff belongs to one zone, avoiding repeated scoring of the
same win through overlapping overall and situational components.

Overall win percentage, PP results and SH results remain display
context without additional scoring weight. Their previously agreed
eligibility rules govern scored comparisons, not extra contributions
to the combined index.

Weights are provisional modeling choices. Retain 40/40/20 as a
sensitivity comparison when reviewing all three historical seasons.

## Historical aggregation and grading

Average unrounded eligible season indices equally within the configured
2023–24 through 2025–26 window. Do not average displayed season grades.

Season grades compare eligible indices within the same season, pooling
all NHL positions. Historical grades compare players with at least one
eligible season in one pooled group across positions.

Ties share a midpoint percentile:
100 × (players below + half the players tied) / comparison group size.

Rating = percentile / 10, rounded to one decimal.

Incomplete seasons do not contribute to the historical average.
Do not substitute zero, redistribute zone weights or use older seasons
outside the configured window.

Display eligible-season counts and included seasons prominently.
A historical grade can remain available when the latest season is
incomplete. It must not be presented as the latest-season grade.

No-participation histories remain Not applicable. Other histories
without eligible seasons remain unrated. Neither is a zero grade.

## Saved implementation

Reference collection:
`node scripts/collectors/collect-faceoff-reference.js`

Saves `faceoff-skaters.csv`, `faceoff-baselines.csv` and
`faceoff-metadata.json` under `data/league-reference/`.

Local calculation, without API requests:
`node scripts/models/calculate-faceoff-ratings.js`

Saves `season-faceoff-indices.csv`, `historical-faceoff-ratings.csv`
and `model-metadata.json` under `data/faceoff-ratings/`.

The current snapshot contains 2,784 player-seasons:
378 eligible, 89 incomplete zone samples, 1,221 limited samples
and 1,096 not applicable. There are 18 reference baselines.

Historical output retains 1,196 players, including 167 rated players.
These counts describe the current snapshot, not permanent requirements.

Fifty-two automated tests cover reference and model behavior across
the project. Saved historical averages, percentiles, grades and source
fingerprints were verified. Calculation checks do not independently
validate the selected weights.

## Implementation checklist

- [x] Classify faceoffs as an auxiliary category.
- [x] Include qualifying centers and wingers without relabeling positions.
- [x] Set the overall minimum at 300 draws.
- [x] Define regular-usage and draw-volume routes for PP and SH.
- [x] Choose zone-specific sample requirements.
- [x] Define baseline groups and weighting.
- [x] Choose scoring inputs and address overlap.
- [x] Agree on provisional zone weights.
- [x] Agree on historical aggregation and grading.
- [x] Build and test league-wide collection.
- [x] Implement season indices and historical grading.
- [ ] Build the Faceoffs tab.
- [ ] Decide how faceoffs contribute to overall value.