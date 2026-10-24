# PuckTrax Veteran Season Participation — provisional decisions

## Purpose

Measure regular-season NHL participation delivered by established players,
separately from performance when playing.

Injuries, healthy scratches, suspensions, late signings and other reasons
for not appearing all affect participation. The measure does not claim
to identify injury durability.

## Veteran eligibility

A player-season requires at least 250 career NHL regular-season games
before that season begins, including exactly 250.

Later appearances do not retroactively qualify an earlier season.
Playoff games do not count toward career eligibility.

Younger players retain their statistics but receive no participation
adjustment from this category.

## Benchmark and schedule treatment

The season participation grade is:

participationGrade = Math.min(10, gamesPlayed / 82 * 10)

82 or more appearances earn 10.0. Below 82, the grade declines
proportionally. Keep this fixed benchmark for 84-game seasons.

Calculate using full precision and display one decimal place.
This is a benchmark-based grade, not a percentile.

Preserve actual games played, including totals above the normal schedule
length after trades. Verified zero-game seasons receive 0.0;
missing or unresolved coverage remains ungraded.

Same-season positional means and medians are supporting context,
not the scoring benchmark.

## Historical participation grade

Use the configured three-season historical window.

Average eligible season participation grades equally, using unrounded
values. Round only the displayed historical grade to one decimal place.

Include verified zero-game seasons as 0.0. Exclude seasons before the
player met the entering-season 250-career-game requirement.

Unresolved coverage remains ungraded, never zero. Flag incomplete
coverage rather than silently presenting it as a complete history.

Display the number of included seasons. If none qualify, the historical
grade remains unavailable.

## Zero-game coverage

A missing statistics row does not automatically establish zero games.

Add zero-game records only when NHL involvement in that season is verified.
Use a small documented exception file for verified zero-game seasons
and unresolved coverage cases.

Current NHL active status can help identify candidates but cannot
establish historical season eligibility by itself.

Do not automatically extend participation deductions into retirement
or seasons exclusively outside the NHL.

## Treatment of other categories

Zero participation applies to the season participation record.
It does not erase statistics or grades from other seasons.

A zero-game season has no qualifying offensive or defensive performance
sample. Those grades remain unavailable rather than becoming zero.
Per-game figures remain unavailable when games played is zero.

## Collection and saved outputs

Collector:
`scripts/collectors/collect-availability-reference.js`

Model runner:
`scripts/models/calculate-availability-ratings.js`

Verified exceptions:
`config/availability-exceptions.json`

Reference outputs:
- `data/league-reference/availability-skaters.csv`
- `data/league-reference/availability-metadata.json`

Model outputs:
- `data/availability-ratings/season-availability-ratings.csv`
- `data/availability-ratings/historical-availability-ratings.csv`
- `data/availability-ratings/model-metadata.json`

Career eligibility uses aggregate NHL regular-season appearances
through the season preceding each evaluated season.

The model metadata records calculation settings and SHA-256
fingerprints of the reference inputs.

## Coverage statuses

- Recorded appearances: preserve the actual games played.
- Verified zero: documented NHL involvement without regular-season
  appearances; eligible veterans receive 0.0.
- Unresolved: games and grade remain unavailable.
- Outside NHL involvement: documented retirement or other exclusion;
  the season receives no availability grade.

Season exclusions do not remove players from search or erase their
recorded statistics and grades.

Historical averages use eligible seasons only. Unresolved veteran
seasons trigger an Incomplete coverage flag, even when an average
can be calculated from the remaining seasons.

## Current coverage limitation

Candidates include players appearing during the historical window,
plus explicitly documented exceptions.

Veterans absent throughout the entire window are not automatically
included. Additional verified exceptions may be required.

The unresolved-season review remains in progress. Do not describe
the collection as fully verified.

## Open decisions

- Complete review of unresolved seasons and candidate coverage.
- Decide player-profile presentation.
- Decide any overall-value contribution.
- Avoid repeated credit or deductions when combining participation
  with performance and contract valuation.

## Implementation checklist

- [x] Define participation as distinct from injury durability.
- [x] Set the entering-season veteran minimum at 250 career games.
- [x] Choose a fixed 82-game benchmark.
- [x] Include all reasons for nonparticipation.
- [x] Establish verified-zero versus missing-coverage treatment.
- [x] Choose and test the season scoring formula.
- [x] Build career-history and participation collection.
- [x] Implement and test equal historical averaging.
- [x] Save season grades, historical grades and input fingerprints.
- [ ] Complete zero-game and excluded-season coverage review.
- [ ] Define historical presentation.
- [ ] Implement the player-profile display.
- [ ] Decide overall-value contribution.