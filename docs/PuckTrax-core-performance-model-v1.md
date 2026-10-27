# PuckTrax Core Performance Model v1 — provisional specification

## Purpose

Combine the existing offensive and defensive models into a descriptive
core performance rating.

This measures recorded performance when playing. It is not yet an
overall player-value, contract-value or projected-ability score.

## Provisional formula

Core index = 0.75 × offensive index + 0.25 × defensive index

Use unrounded underlying indices, not category percentiles or
displayed 0–10 grades.

Apply the same coefficients to C, L, R and D.

These coefficients are provisional design choices. They are not
empirically estimated shares of actual hockey value.

## Historical aggregation

Use the configured 2023–24 through 2025–26 historical window.

The initial historical trial combines the saved historical offensive
and defensive indices. Both must cover the same included seasons
and use the same latest recorded NHL position.

Do not silently combine mismatched histories. Flag them for review.

Missing or ineligible category indices remain unavailable, never zero.
Do not redistribute the missing category's weight.

One-, two- and three-season qualifying histories share the comparison
pool. Display the number and identity of included seasons.

## Grading

Calculate the combined index for each eligible player, then calculate
its percentile within the same latest recorded NHL position.

Use midpoint percentiles for ties:

Percentile = 100 × (players below + 0.5 × players tied) / group size

Core rating = percentile / 10

Retain unrounded indices and percentiles. Display the rating to one
decimal place.

The rating describes positional standing in this composite.
It is not a percentage of maximum ability, a goal-value estimate,
or proof of absolute value across positions.

## Existing components

The offensive index already includes its power-play addition.
The defensive index already includes block and takeaway bonuses.
Do not add those contributions again.

Discipline, faceoffs, physicality and availability do not contribute
to this initial core trial. Their future treatment requires separate
decisions.

## Scaling and interpretation

Use the existing index scales for this provisional trial without
additional standardization.

The offensive and defensive indices have different distributions.
75/25 coefficients do not guarantee a 75/25 share of score variance
or a 75/25 share of actual hockey impact.

The defensive model uses unadjusted on-ice outcomes. Team systems,
teammates, opponents, deployment and goaltending can affect results.
It does not fully isolate individual defensive contribution.

Combining indices preserves extreme performance in either direction.
It does not resolve limitations in the component models.

## Fixed review sample

Use these players for the initial documented review:

- Connor McDavid
- Nathan MacKinnon
- Nikita Kucherov
- Cale Makar
- Leon Draisaitl
- David Pastrnak
- Quinn Hughes
- Jack Eichel
- Adam Fox
- Aleksander Barkov
- Anthony Cirelli
- Jaccob Slavin
- Anze Kopitar
- Sidney Crosby
- Connor Bedard
- Mark Jankowski
- Jackson Blake
- Jesper Fast
- Pierre-Edouard Bellemare
- Dominic James
- Brock Boeser
- Trent Frederic
- Jake Evans
- John Leonard

The sample includes stars, contrasting offensive and defensive
results, supporting players, shorter histories and an eligibility
edge case.

This is a diagnostic sample, not an independent validation set.
Several players already informed the model discussion.

## Review procedure

For each player, inspect:

- Offensive and defensive indices and weighted contributions.
- Combined index, percentile and comparison-group size.
- Included seasons, games and five-on-five minutes.
- Component statistics behind unusual results.
- Missingness, eligibility and matching historical coverage.

Also inspect the full eligible distribution, including leaders,
lowest results and players outside the named sample.

Compare 50/50, 70/30, 75/25 and 80/20 as sensitivity scenarios.
Keep 75/25 as the provisional default during review.

Do not introduce player-specific exceptions or change weights solely
to obtain preferred ratings for individual players.

Document concerns before revising the formula. Any revision requires
a stated rationale and a new review of all affected players.

## Implementation checklist

- [x] Choose underlying indices instead of averaging category grades.
- [x] Choose provisional 75/25 offense/defense coefficients.
- [x] Define the initial review sample and interpretation.
- [ ] Add configuration settings.
- [ ] Implement calculation and historical-coverage checks.
- [ ] Add automated calculation and missingness tests.
- [ ] Save trial outputs and source fingerprints.
- [ ] Review the fixed sample and full eligible distribution.
- [ ] Decide whether the composite is ready for player-profile display.
- [ ] Decide auxiliary contributions separately.
- [ ] Decide availability and contract-value treatment separately.