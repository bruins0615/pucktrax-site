# PuckTrax offensive methodology — historical decision inventory

This is the earlier decision inventory, retained to explain how the methodology developed. Its unresolved questions and implementation notes describe that earlier stage. **Use [Offensive Model v1](PuckTrax-offensive-model-v1.md) as the current scoring specification.** Five-on-five splits, numerical weights, percentile ratings, and saved scoring outputs have since been implemented.

## Outputs and historical scope

| Output | Agreed purpose and scope |
|---|---|
| Current Trend | Current-season recorded results to date, updated as data is collected. Keep sample labels visible. Do not silently blend previous seasons into it. |
| Overall Performance | Up to the three most recent completed seasons, with equal season emphasis and no recency bonus. |
| Projected Performance | A separate future project. Age, development, and expected decline are not automatic adjustments to recorded performance. |

For live 2026–27 data, Current Trend covers 2026–27; Overall uses 2023–24, 2024–25, and 2025–26.

Overall will use equal-season averaging rather than pooling production and exposure across seasons. With three eligible seasons, each has one-third emphasis. Where fewer seasons are eligible, use the available eligible history and disclose its size. Do not replace a recent ineligible season with an older season outside the three-season window without a new decision.

The stage at which season averaging occurs—raw metrics or comparable season scores—remains undecided. Different metrics may have different eligible histories, which must remain visible rather than being silently filled with zeros.

## Position and comparison context

- Preserve NHL-provided position labels exactly as collected. No manual role overrides.
- Faceoff volume and faceoffs per game can describe center responsibilities without changing a position label.
- Position and deployment matter when interpreting results. The precise position-group scoring method is not yet defined.
- Current collection: 89 selected players and 432 player-season records. Comparisons are not league-wide benchmarks.
- Rank columns and comparison-group sizes were removed from the review table. Revisit rankings when weighted values are developed.

## Offensive components

### Individual scoring production

Agreed hierarchy: **goals > primary assists > secondary assists**. Numerical weights remain unassigned.

Collected all-situations fields include `goals`, `assists`, `points`, `totalPrimaryAssists`, and `totalSecondaryAssists`.

The review includes individual even-strength goals and points as totals, per-game rates, and per-60 rates:

```text
EV goals/game = evenStrengthGoals / gamesPlayed
EV points/game = evenStrengthPoints / gamesPlayed
EV goals/60 = evenStrengthGoals * 3600 / evTimeOnIce
EV points/60 = evenStrengthPoints * 3600 / evTimeOnIce
```

`evTimeOnIce` is total seconds. Even strength is broader than strictly five-on-five. EV primary/secondary assist splits are not collected. Total EV assists can be derived as EV points minus EV goals, but cannot be separated into primary and secondary from those totals alone.

Points summarize goals plus assists. They must not independently duplicate those contributions in an additive score. Whether individual EV scoring ultimately uses per-game rates, per-60 rates, or a defined combination remains open.

### Individual shot generation

- Main measure: `individualShotsForPer60`, the player's own shots on goal per 60 minutes of five-on-five ice time from `puckPossessions`.
- All-situations shots remain context.
- Individual total attempts, misses, blocked attempts, and attempt rates receive no independent offensive value for now.
- Retain those fields for future investigation. A future miss/blocked-attempt penalty would require evidence and appropriate opportunity and role comparisons; it is not part of the current model.
- `shotAttemptsBlocked` refers to the player's attempts being blocked. `blockedShots` describes the player blocking opponents' shots and belongs in the defensive inventory.

### Scoring efficiency

Shooting percentage is context only, with no independent scoring weight. It can support later sustainability review, but a high percentage alone does not increase valuation. Shot quality and expected goals are not currently incorporated.

### Team on-ice offensive context

Candidate measures:

```text
Estimated 5v5 team unblocked attempts/60
  = usatFor * 3600
    / (timeOnIcePerGame5v5SummaryShooting * gamesPlayed)

EV team goals for/60
  = evenStrengthGoalsFor * 3600 / evTimeOnIce
```

The summary-shooting five-on-five time is seconds per game; reconstructing total time from that reported average makes the attempt rate approximate. It is more precise than the whole-second average previously taken from `puckPossessions`.

Team unblocked attempts include shots on goal and misses. The choice to exclude individual attempts from value does not exclude this separate team-context measure.

These are team results while a player is on the ice, not whole-team season totals or isolated individual impact. They remain unadjusted for teammates, opponents, deployment, and team systems. Their eventual numerical role is undecided.

Team fields in the review table begin with `team`. Do not mistake team goals for the player's own goals. Own scoring and shooting contribute to team on-ice results, creating overlap that must be addressed before scoring.

## Power-play offense

Main individual production measure: **PP points per game**.

Main team view: **team on-ice PP goals for per game**.

```text
Individual PP points/game = powerPlayPoints / gamesPlayed
Team on-ice PP goals/game = powerPlayGoalFor / gamesPlayed
PP time/game = ppTimeOnIce / gamesPlayed
```

Keep PP point totals, total minutes, and time per game visible. Display time per game as minutes:seconds for readability. Numeric time remains useful for calculations.

PP points/60 remains secondary context:

```text
PP points/60 = powerPlayPoints * 3600 / ppTimeOnIce
```

This rate uses actual PP exposure, not full-game time. No standardized two- or three-minute replacement is being introduced.

Individual PP goals will not be added for now. PP points provide a shared starting production measure for forwards and defensemen. Whether the general goals/primary/secondary hierarchy should later apply within PP scoring remains open.

A provisional **75 total PP minute** threshold labels rate samples. It is not proof of reliable PP scoring ability. Below the threshold, retain actual points and per-game contribution but label the opportunity limited. Zero PP seconds yields an unavailable per-60 rate, not zero efficiency. It does not follow that every below-cutoff per-game contribution should be excluded from scoring; that policy is still open.

Per-game measures intentionally reflect actual opportunity as well as production. Always show usage beside them. Limited usage alone does not establish poor PP ability.

## Shorthanded offense

Shorthanded scoring is an offensive bonus, not an expectation of penalty killing. Zero scoring does not incur a penalty. Defensive penalty-killing effectiveness will be evaluated separately.

Initial view:

```text
SH time/game = shTimeOnIce / gamesPlayed
Team on-ice SH goals/game = shortHandedGoalsFor / gamesPlayed
```

Retain total SH minutes and team on-ice goal counts. A provisional **75 total SH minute** cutoff identifies meaningful usage; below it use “Limited SH opportunity.” Keep all scoring events visible, including those below the threshold. No exposure is labeled separately.

SH goals are rare even for regular penalty killers. Eligibility does not establish stable scoring ability. Team goals can appear in several teammates' records and are not separate individual scoring events.

Individual SH points are not yet part of the agreed initial view. They could potentially be derived from total points minus EV points minus PP points, but that partition should first be verified against the source's SH points. It has not been implemented as an agreed scoring input.

## Sample rules

| Area | Provisional threshold | Interpretation |
|---|---|---|
| Five-on-five rate review | 150 total 5v5 minutes | Below threshold: retain record, label limited sample, exclude from initial rate-based rankings. |
| Power play | 75 total PP minutes | Qualifies PP rate interpretation; below threshold retains recorded contribution with limited-opportunity context. |
| Shorthanded | 75 total SH minutes | Meaningful SH usage flag; scoring remains sparse bonus context. |

These are separate situation-specific rules. A player can qualify for five-on-five and not for either special team. They do not erase actual goals or points. Missing values, zero production, and no opportunity are different states.

The application of these thresholds to an eventual combined score, including partial histories, must be explicitly defined. There is no finalized EV-specific threshold distinct from the 5v5 rule.

## Avoiding overlap

- Total points include goals and assists.
- All-situations production includes EV, PP, and SH contributions; do not add full special-teams credit on top of an unchanged all-situations score.
- EV and 5v5 cover different situations. Do not divide an EV numerator by 5v5 time.
- PP points include PP goals.
- Individual offense appears within team on-ice results.
- Per-game and per-60 versions describe the same underlying production from different perspectives; they are not automatically independent value sources.
- Role effectiveness and deployment are context, not automatically extra additive rewards.

The intended structure permits separate EV, PP, and SH contributions feeding a larger offensive score. The exact combination and overlap adjustments have not been designed.

## Remaining decisions before a finished offensive score

1. Choose the scoring-production inputs: how to use EV per-game versus per-60 rates, and where assist differentiation fits given the missing EV split.
2. Define how current-season and historical sample rules affect score availability, rather than only review labels.
3. Decide how to compare seasons and positions fairly before equal-season aggregation; select valid reference populations and normalization methods.
4. Decide whether unadjusted team on-ice measures remain context or receive limited score influence, and address their overlap with individual production.
5. Define EV, PP, and SH components and their interaction. Specify the SH bonus behavior without assigning negative value for zero SH scoring.
6. Choose numerical weights only after the inputs and overlap rules are settled.
7. Validate on a broader set of player types and seasons, beyond examples matching expectations. Revisit cutoffs and investigate exceptions.

Projection, age curves, expected future contracts, and development assumptions remain outside this stage.

## Data and implementation notes

- Original collected CSV: `/Users/andrewvayo/dev/pucktrax-site/data/skater-performance.csv`.
- The original derived `on-ice-offense-review.csv` was created in the chat workspace; it is not a repository-generated output. Current repeatable scoring outputs live under `data/offensive-ratings/`.
- Preserve the source dataset when adding derived review fields.
- Review-file calculations have been performed separately; a reusable analysis builder has not yet been established in the project repository.
- One historical source discrepancy remains flagged: Jake Walman's 2021–22 record has one individual PP point but zero team on-ice PP goals. This can reflect event/on-ice attribution or reporting differences; it has not been confirmed as an error.
- Future data collection must deliberately refresh current-season records. The collector's existing completion check based on the presence of assist fields is not a live-update policy.

## Suggested next decision

Choose the primary **individual EV scoring rate** before discussing weights: per game measures contribution per appearance; per 60 measures production relative to EV usage. Keep both visible, but explicitly decide their roles rather than independently rewarding the same production twice.
