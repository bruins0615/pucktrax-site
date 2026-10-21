# Offensive category checklist

Status: implemented as `offense-v1-provisional`. Ready to support development of the next category; not a finalized or independently validated measure of player value.

## Completed

- [x] Define individual five-on-five goals, primary assists, secondary assists, and shots on goal as scoring inputs.
- [x] Implement agreed 54/27/9/10 weights and individual PP points/game addition.
- [x] Apply the 300-minute five-on-five eligibility minimum.
- [x] Average eligible season indices equally across the three-season historical window, then calculate positional percentiles.
- [x] Display decimal 0–10 offensive ratings, keeping unrated distinct from zero.
- [x] Preserve recorded production, games, minutes, and eligible-season counts.
- [x] Collect league-wide historical core stats, five-on-five data, PP data, SH context, and team context.
- [x] Display team comparisons separately from the numerical offensive score.
- [x] Apply the 75-minute PP baseline cutoff and hide PP comparison bars below it.
- [x] Display SH production and independent 75-minute SH sample labels without a numerical SH addition.
- [x] Build player profiles with historical grades, season history, and analysis tabs.
- [x] Build player search, position/rating/history filters, sorting, and historical team filtering.
- [x] Include traded players under each recorded team without duplicating directory entries.
- [x] Review desktop and phone behavior.
- [x] Establish automated model/reference tests, source fingerprints, and Git checkpoints.

## Deferred improvements

- [ ] Continue checking results across roles, positions, seasons, and sample sizes before finalizing the model.
- [ ] Decide whether an additional short-qualifying-sample label is useful; numeric exposure is already displayed.
- [ ] Implement live Current Trend with current-season collection and matching baselines.
- [ ] Verify current-roster coverage separately from historical team affiliations.
- [ ] Develop projections separately from recorded performance.
- [ ] Consider any future SH scoring addition or SH baseline through a separate methodological decision.
- [ ] Develop other categories before assigning overall grades or two-way player descriptors.

These deferred items do not block beginning the defensive data inventory.

## Maintenance

- Update this checklist when implementation status changes.
- Keep formulas, thresholds, interpretation, and limitations in the model specification.
- Historical data currently covers 2023–24 through 2025–26; do not silently roll the window forward.
- Test counts and dataset sizes describe snapshots, not permanent requirements.

## References

- [Offensive model specification](PuckTrax-offensive-model-v1.md)
- [Script maintenance](script-maintenance.md)
- [Collector guide](collector-guide.md)