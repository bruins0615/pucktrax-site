# PuckTrax documentation

## Current references

- [Offensive Model v1](PuckTrax-offensive-model-v1.md): canonical provisional formula, weights, eligibility, historical aggregation, grading, presentation, implementation checklist, and deferred improvements.
- [Collector guide](collector-guide.md): comparison-player and Bruins entry points, shared collection, output destinations, and current roster limitations.
- [Script maintenance](script-maintenance.md): script lifecycle, what to rerun, completed migrations, and maintenance priorities.
- [Defensive Model v1](PuckTrax-defensive-model-v1.md): provisional suppression formula, action bonuses, eligibility, limitations, and implementation checklist.
- [Discipline Model v1](PuckTrax-discipline-model-v1.md): PIM/game foundation, positive drawing bonus, eligibility, historical grading, limitations, and implementation checklist.
- [Faceoff Model v1](PuckTrax-faceoff-model-v1.md): provisional participation rules, special-teams qualification routes, data limitations, and open modeling decisions.
- [Physicality Model v1](PuckTrax-physicality-model-v1.md): positive-only hits/game bonus, positional baselines, eligibility, cap, and implementation checklist.
- [Veteran Season Participation](PuckTrax-availability-model-v1.md): entering-season career eligibility, benchmark-based grading, historical averaging, coverage rules, implementation, and remaining decisions.
- [Model checklist](model-checklist.md): project-wide implementation status, remaining coverage work, overall-value decisions, and later stages.
- [Core Performance Model v1](PuckTrax-core-performance-model-v1.md): provisional 75/25 index combination, positional grading, fixed review sample, limitations, and implementation checklist.

## Historical reference

- [Offensive methodology inventory](PuckTrax-offensive-methodology.md): earlier data inventory and decision history. Where its open questions or implementation status differ from v1, the v1 specification takes precedence.

## Updating a model

Update the specification and model metadata whenever a formula, threshold, grouping, historical window, or rating interpretation changes. Bump the model version for a behavioral change and regenerate ratings from a consistent reference snapshot. Do not silently apply new rules to old saved outputs.

## Category structure

Core categories: offense and defense.

Auxiliary categories: discipline, faceoffs, physicality, and veteran
availability. Their overall contributions remain undecided and are
not assumed to carry the same importance as core categories.

Core performance provisionally combines 75% offensive index and 25%
defensive index before positional percentile grading. This composite
is not yet implemented. Auxiliary contributions and the overall-value
formula remain undecided.

Faceoff participation must be considered before assigning a rating;
players without that responsibility should not receive a poor score
for lacking opportunities.

Additional directory filters are deferred until the auxiliary category
structure is established.

## Current implementation status

Offense and defense are implemented as provisional descriptive models. Both use a 300-minute five-on-five season eligibility minimum and equal averaging of eligible season indices within the configured three-season historical window. Player profiles display separate historical offensive and defensive grades, season histories, and five-on-five, defensive, special-teams, and team-context analysis. The directory supports both rating categories, independent rating filters, and category-specific sorting. Power-play production contributes to offense. Penalty killing is displayed as context without a separate defensive-score contribution. Discipline season and historical ratings are implemented provisionally
using a PIM/game foundation and a 0.10 positive-only above-baseline drawing bonus. The Discipline tab displays historical grades, season history,
recorded penalty statistics and positional comparisons, with
calculation components available in collapsed details. Overall grades, player-style labels, live Current Trend, and projections remain unimplemented.

Faceoff season and historical ratings are implemented provisionally
using 50/30/20 defensive/offensive/neutral-zone weights. Comparisons
pool qualifying takers across positions. Incomplete zone seasons remain
unscored. PP and SH faceoff comparisons use separate qualification rules
and contribute no additional index weight. The Faceoffs tab displays historical coverage, season history and
independently qualified comparisons, with explicit reasons for
incomplete combined grades.

Physicality uses a positive-only above-average positional hits/game
bonus with a 0.10 coefficient and 0.25 cap. The Physicality tab shows
latest-season statistics, positional comparisons and expandable
season history. Supporting rates and bonus calculations are collapsed.
No standalone physicality grade is assigned; historical bonus
aggregation and overall-value contribution remain undecided.

Veteran Availability season and historical grades are implemented.
Eligibility requires 250 career NHL regular-season appearances entering
the evaluated season. The season grade is games played divided by 82,
multiplied by 10 and capped at 10.0. Historical grades average eligible
seasons equally. Verified zero-game seasons count as zero; documented
outside-NHL seasons are excluded. Unresolved coverage remains ungraded
and is explicitly flagged. The Availability tab displays historical
coverage and season-level explanations. Coverage review remains open.