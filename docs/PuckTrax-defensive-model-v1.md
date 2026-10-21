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

A season qualifies at 150 five-on-five minutes, including exactly 150.

Below-cutoff seasons retain recorded statistics but receive no defensive index or bonus-only score. Unrated is distinct from zero.

Eligible scores require valid inputs and available same-season positional baselines with positive standard deviations. Missing values must not silently become zeros.

Use NHL-provided C, L, R, and D positions. Each eligible player receives equal weight in the positional baseline.

## Individual-action treatment

Blocks and takeaways provide proportional positive bonuses without subtracting positional averages. Zero production earns zero bonus.

The block coefficient exceeds the takeaway coefficient. Both coefficients currently apply equally across positions.

Hits remain supporting context and do not affect the index. Total shot attempts against remain supporting context rather than an additional weighted suppression measure.

No penalty-killing defensive component is included yet. Its possible addition requires a separate decision.

## Interpretation and future decisions

On-ice suppression and goal outcomes are shared team results. Blocks can overlap with unblocked-attempt suppression; their additive credit is an explicit modeling choice.

Playing time, games, and sample size must remain visible. Eligibility does not establish statistical reliability.

Historical defensive aggregation, percentile grading, and any overall-player combination are not implemented or defined by this specification.

## Saved season implementation

Run `node scripts/models/calculate-defensive-ratings.js` to calculate
season indices from the saved team-context reference files.

Outputs:
- `data/defensive-ratings/season-defensive-indices.csv`
- `data/defensive-ratings/model-metadata.json`

The current snapshot contains 2,784 player-seasons: 2,225 eligible
indices and 559 unscored records. Outputs preserve exposure, the
foundation, individual bonuses, and suppression contributions.

Metadata records model settings and SHA-256 fingerprints of both
input files. Nineteen automated tests pass. Saved contribution sums,
eligibility handling, and fingerprints were verified.

No defensive percentile grades or historical defensive aggregation
are calculated yet. These counts describe this reference snapshot.

## Implementation checklist

- [x] Inventory defensive candidates and limitations.
- [x] Collect league-wide suppression, blocks, and takeaways.
- [x] Build same-season positional baselines.
- [x] Review multiple players and historical seasons.
- [x] Agree on the provisional formula and 150-minute cutoff.
- [x] Record coefficients in shared configuration.
- [x] Implement and test season defensive indices.
- [x] Review calculated contributions across the comparison group.
- [ ] Agree on historical aggregation and rating conversion.
- [ ] Add defensive results to the website.
- [ ] Decide whether and how penalty killing contributes.
- [ ] Develop overall-player scoring separately.