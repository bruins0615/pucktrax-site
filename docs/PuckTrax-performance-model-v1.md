# PuckTrax Performance Model — provisional specification

## Purpose

Combine Core performance with explicitly approved auxiliary adjustments.

Preserve the separate Core index and grade so users can distinguish
offensive/defensive performance from supporting contributions.

This is a descriptive performance composite. It is not yet contract
value, total season value delivered or projected ability.

## Provisional formula

Core index = 0.75 × offensive index + 0.25 × defensive index

Discipline adjustment = 0.025 × discipline index

Season faceoff adjustment = 0.025 × qualifying season faceoff index

Historical faceoff adjustment =
sum of season faceoff adjustments across qualifying Core seasons
/ number of qualifying Core seasons

Performance index =
Core index + Discipline adjustment + Historical faceoff adjustment
+ Historical Physicality bonus

Use unrounded indices. Do not combine displayed category grades.

The Discipline index already includes its penalties-drawn bonus.
Do not add that bonus again.

The coefficient is a provisional design choice, not an empirically
estimated conversion to goals or wins.

Historical Physicality bonus =
average capped season Physicality bonus across qualifying Core seasons

## Historical coverage

Core and Discipline must cover the same included historical seasons
and use the same latest recorded NHL position.

Missing, ineligible or mismatched inputs remain ungraded.
Do not substitute zero or redistribute weights.

Retain Core results separately when the broader Performance result
cannot be calculated.

## Faceoff adjustment coverage

Apply signed faceoff adjustments only in seasons included in the
player's qualifying Core history.

A qualifying faceoff season can add credit or produce a deduction.
Incomplete, limited-sample and not-applicable faceoff seasons receive
no adjustment. Their standalone faceoff indices remain unavailable,
not zero grades.

Average the season adjustments across all qualifying Core seasons,
not only the seasons with eligible faceoff indices.

Preserve the number and identity of seasons supporting the adjustment.
For example: Faceoff adjustment supported in 1 of 3 Core seasons.

An unexpectedly missing faceoff record is a coverage problem.
Do not silently treat it as a non-taker or incomplete sample.

Faceoff eligibility uses the existing overall and zone requirements.
No additional PP or SH adjustment is included.

## Grading

Calculate a new positional percentile from the combined Performance
index among players with eligible matched histories.

Use midpoint percentiles for ties. Divide the percentile by 10 and
round the displayed grade to one decimal.

The adjustment affects the index before ranking. It is not a direct
addition to or subtraction from the displayed Core grade.

A player's grade can change because positional peers also move.

## Interpretation and limitations

Positive Discipline indices add credit; negative indices deduct credit.
Zero produces no index adjustment.

The PIM foundation includes fighting and misconduct minutes.
It describes recorded penalty burden, not an estimate of power-play
opportunities conceded.

Core retains its existing limitations, including unadjusted defensive
on-ice results and differences between component scales.

Preserve qualifying-season counts, included seasons and minutes.
Qualifying short histories remain unadjusted.

## Other categories

Faceoffs are implemented as a signed 0.025 adjustment using the
season-coverage rules above.

Physicality is implemented as a positive-only bonus using a 0.025
season coefficient and 0.25 season cap. Capped bonuses are averaged
across qualifying Core seasons, including valid zero-bonus seasons.
Missing eligible records fail validation. No second coefficient
is applied.

Current outputs use performance-v3-provisional.

Availability remains separate from performance when playing.
Its eventual relationship to season value delivered is undecided.

## Saved implementation

Runner:
`scripts/models/calculate-performance-ratings.js`

Outputs:
- `data/performance-ratings/historical-performance-ratings.csv`
- `data/performance-ratings/performance-review.csv`
- `data/performance-ratings/model-metadata.json`

Outputs preserve Core, Discipline and Faceoff adjustments, the
historical Physicality bonus, supporting-season counts and IDs,
combined Performance indices and positional grades.

Pre-Faceoff and pre-Physicality indices and grades remain available
for comparison. Positive-only Physicality credit does not guarantee
an unchanged or higher percentile grade when peers gain more.

Metadata records settings, input model versions, output counts and
SHA-256 fingerprints of the exact inputs.

The current reference snapshot contains 1,196 historical records:
864 graded and 332 ungraded. 22 named examples are saved for review.
Counts describe this snapshot, not permanent requirements.

A read-only verification reconciled source indices, weighted adjustments,
combined indices, positional percentiles, rounding and review rows.
Input fingerprints matched. This verifies implementation behavior,
not independent validity as a measure of player value.

The website continues to display Core. Performance remains a saved
review output while additional auxiliary contributions are considered.

## Implementation checklist

- [x] Choose the provisional 0.025 Discipline coefficient.
- [x] Preserve Core as a separate result.
- [x] Document interpretation and coverage requirements.
- [x] Implement the adjustment and historical matching.
- [x] Test missingness, negative values, zero and coverage mismatches.
- [x] Save results, weighted contributions and source fingerprints.
- [x] Review the agreed examples and initial distribution of changes.
- [x] Verify saved calculations, percentiles and input fingerprints.
- [ ] Decide presentation before changing displayed grades.
- [ ] Decide remaining auxiliary contributions separately.
- [x] Implement and test signed Faceoff adjustments.
- [x] Validate partial histories and missing faceoff records.
- [x] Verify saved Faceoff adjustments, support counts and final percentiles.
- [x] Save supporting-season counts and regenerate Performance outputs
      under performance-v2-provisional.
- [x] Integrate and test historical Physicality bonuses.
- [x] Regenerate performance-v3-provisional outputs.
- [x] Verify all components, season averaging, final percentiles
      and input fingerprints.