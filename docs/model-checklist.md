# PuckTrax model checklist

All implemented categories remain provisional descriptive measures.
Passing tests verifies calculation behavior, not independent validity
as a measure of player value.

## Core categories

- [x] Implement offensive season and historical ratings.
- [x] Implement defensive season and historical ratings.
- [x] Display grades, season histories, sample eligibility and comparisons.
- [x] Add offensive and defensive directory filtering and sorting.

## Auxiliary categories

- [x] Implement Discipline ratings and player-profile tab.
- [x] Implement Faceoff ratings and player-profile tab.
- [x] Explain incomplete faceoff samples and role eligibility.
- [x] Implement capped positive-only Physicality season bonuses and tab.
- [x] Implement veteran Availability collection, grades and tab.
- [x] Distinguish verified zero, unresolved and excluded availability seasons.

## Remaining category work

- [ ] Complete unresolved availability and candidate-coverage review.
- [ ] Decide whether to aggregate Physicality bonuses historically.
- [ ] Review results across roles, positions, seasons and sample sizes.
- [ ] Decide whether additional auxiliary categories are necessary.

## Overall player value

- [ ] Define what the overall score represents.
- [ ] Decide how offense and defense contribute to the core score.
- [ ] Decide how each auxiliary category contributes.
- [ ] Handle ineligible and not-applicable categories without treating
      missing grades as zero.
- [ ] Account for different grading scales before combining categories.
- [ ] Decide whether Availability modifies value delivered or contributes
      separately, avoiding repeated deductions for missed games.
- [ ] Test alternative weights and inspect their effects across players.
- [ ] Document the agreed formula, limitations and interpretation.
- [ ] Implement and test the overall calculation.
- [ ] Add overall and auxiliary directory controls once approved.

## Later stages

- [ ] Connect performance and participation to contract valuation.
- [ ] Verify current-roster coverage.
- [ ] Implement current-season Current Trend separately.
- [ ] Develop projections separately from recorded performance.
- [ ] Define evidence-based player-style labels.

## Maintenance

Keep detailed formulas and eligibility rules in each category's model
specification. This checklist tracks progress and outstanding decisions.

The historical window remains 2023–24 through 2025–26 until explicitly
changed. Dataset sizes and test counts describe snapshots.