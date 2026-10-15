# PuckTrax documentation

## Current references

- [Offensive Model v1](PuckTrax-offensive-model-v1.md): canonical provisional formula, weights, eligibility, historical aggregation, percentile grading, sample display, implementation, and limitations.
- [Collector guide](collector-guide.md): comparison-player and Bruins entry points, shared collection, output destinations, and current roster limitations.
- [Script maintenance](script-maintenance.md): script lifecycle, what to rerun, completed migrations, and maintenance priorities.

## Historical reference

- [Offensive methodology inventory](PuckTrax-offensive-methodology.md): earlier data inventory and decision history. Where its open questions or implementation status differ from v1, the v1 specification takes precedence.

## Updating a model

Update the specification and model metadata whenever a formula, threshold, grouping, historical window, or rating interpretation changes. Bump the model version for a behavioral change and regenerate ratings from a consistent reference snapshot. Do not silently apply new rules to old saved outputs.

The current version is `offense-v1-provisional`. Grades describe recorded offensive production rather than overall player value or projections. Player-style labels, defensive grades, live Current Trend, and the production profile UI are not implemented yet. Conversation mockups are separate from website code.

Recent agreed decisions now captured in v1: 54/27/9/10 five-on-five weighting, PP points/game multiplied by 1, no team-context score weight, no numerical SH addition, unchanged qualifying small samples, equal eligible-season indices before historical percentiles, decimal 0–10 percentile ratings, and recorded exposure alongside eligible exposure.
