# PuckTrax documentation

## Current references

- [Offensive Model v1](PuckTrax-offensive-model-v1.md): canonical provisional formula, weights, eligibility, historical aggregation, percentile grading, sample display, implementation, and limitations.
- [Collector guide](collector-guide.md): comparison-player and Bruins entry points, shared collection, output destinations, and current roster limitations.
- [Script maintenance](script-maintenance.md): script lifecycle, what to rerun, completed migrations, and maintenance priorities.
- [Offensive checklist](offense-checklist.md): completed implementation, deferred improvements, and readiness to begin the next category.
- [Defensive Model v1](PuckTrax-defensive-model-v1.md): provisional suppression formula, action bonuses, eligibility, limitations, and implementation checklist.
- [Discipline Model v1](PuckTrax-discipline-model-v1.md): PIM/game foundation, positive drawing bonus, eligibility, historical grading, limitations, and implementation checklist.

## Historical reference

- [Offensive methodology inventory](PuckTrax-offensive-methodology.md): earlier data inventory and decision history. Where its open questions or implementation status differ from v1, the v1 specification takes precedence.

## Updating a model

Update the specification and model metadata whenever a formula, threshold, grouping, historical window, or rating interpretation changes. Bump the model version for a behavioral change and regenerate ratings from a consistent reference snapshot. Do not silently apply new rules to old saved outputs.

## Current implementation status

Offense and defense are implemented as provisional descriptive models. Both use a 300-minute five-on-five season eligibility minimum and equal averaging of eligible season indices within the configured three-season historical window. Player profiles display separate historical offensive and defensive grades, season histories, and five-on-five, defensive, special-teams, and team-context analysis. The directory supports both rating categories, independent rating filters, and category-specific sorting. Power-play production contributes to offense. Penalty killing is displayed as context without a separate defensive-score contribution. Discipline season and historical ratings are implemented provisionally
using a PIM/game foundation and a 0.10 positive-only above-baseline drawing bonus. The Discipline tab is not implemented yet. Overall grades, player-style labels, live Current Trend, and projections remain unimplemented.