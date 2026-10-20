const test = require("node:test");
const assert = require("node:assert/strict");

const {
    requireNumber,
    calculateSeasonScore,
    addPercentileRatings,
    buildHistoricalScores
} = require("../scripts/models/calculate-offensive-ratings");

const {
    buildReference,
    calculateBaselines
} = require("../scripts/collectors/collect-league-reference");

const {
    buildPowerPlayReference
} = require("../scripts/collectors/collect-powerplay-reference");

const {
    buildTeamReference
} = require("../scripts/collectors/collect-team-reference");

test("missing numbers are rejected, but zero is valid", () => {
    assert.equal(requireNumber("0", "test value"), 0);

    for (const value of ["", " ", null, undefined, "invalid"]) {
        assert.throws(() => requireNumber(value, "test value"));
    }
});

test("percentiles share ties and leave unscored players unrated", () => {
    const records = [
        { player: "A", position: "C", offensiveIndex: 0 },
        { player: "B", position: "C", offensiveIndex: 1 },
        { player: "C", position: "C", offensiveIndex: 1 },
        { player: "D", position: "C", offensiveIndex: 3 },
        { player: "E", position: "C", offensiveIndex: null }
    ];

    const results = addPercentileRatings(
        records,
        (record) => record.position,
        "offensiveIndex"
    );

    assert.deepEqual(
        results.map((record) => record.percentile),
        [12.5, 50, 50, 87.5, null]
    );

    assert.deepEqual(
        results.map((record) => record.offenseRating),
        [1.3, 5.0, 5.0, 8.8, null]
    );

    assert.equal(results[0].comparisonGroupSize, 4);
    assert.equal(results[4].comparisonGroupSize, null);
});

test("season score applies the agreed weights and PP addition", () => {
    const skater = {
        season: "20252026",
        playerId: "1",
        player: "Example Player",
        position: "C",
        gamesPlayed: "20",
        estimatedMinutes5v5: "300",
        sampleStatus: "Eligible",
        goalsPer605v5: "2",
        primaryAssistsPer605v5: "0.5",
        secondaryAssistsPer605v5: "1.25",
        individualShotsForPer60: "1.5"
    };

    const pp = {
        sampleStatus: "Limited PP opportunity",
        powerPlayPointsPerGame: "0.2"
    };

    const metrics = [
        "goalsPer605v5",
        "primaryAssistsPer605v5",
        "secondaryAssistsPer605v5",
        "individualShotsForPer60"
    ];

    const baselines = new Map(
        metrics.map((metric) => [
            `20252026-C-${metric}`,
            {
                mean: "1",
                populationStandardDeviation: "0.5",
                scalingStatus: "Available"
            }
        ])
    );

    const result = calculateSeasonScore(skater, pp, baselines);

    // Z-scores are 2, -1, 0.5, and 1.
    // Weighted sum: 1.08 - 0.27 + 0.045 + 0.10 = 0.955.
    assert.ok(Math.abs(result.fiveOnFiveScore - 0.955) < 1e-12);
    assert.equal(result.powerPlayContribution, 0.2);
    assert.ok(Math.abs(result.offensiveIndex - 1.155) < 1e-12);
});

test("five-on-five eligibility starts at 150 minutes", () => {
    const player = {
        playerId: 1,
        seasonId: 20252026,
        skaterFullName: "Example Player",
        positionCode: "C",
        gamesPlayed: 10
    };

    for (const [secondsPerGame, expectedStatus] of [
        [899.9, "Limited sample"],
        [900, "Eligible"],
        [900.1, "Eligible"]
    ]) {
        const scoring = {
            ...player,
            timeOnIcePerGame5v5: secondsPerGame,
            goals5v5: 0,
            assists5v5: 0,
            primaryAssists5v5: 0,
            secondaryAssists5v5: 0,
            points5v5: 0,
            goalsPer605v5: 0,
            primaryAssistsPer605v5: 0,
            secondaryAssistsPer605v5: 0
        };

        const possession = {
            ...player,
            individualShotsForPer60: 0
        };

        const [result] = buildReference(
            [scoring],
            [possession],
            20252026
        );

        assert.equal(result.sampleStatus, expectedStatus);
    }
});

test("power-play eligibility starts at 75 minutes", () => {
    const player = {
        playerId: 1,
        seasonId: 20252026,
        skaterFullName: "Example Player",
        positionCode: "C",
        gamesPlayed: 10
    };

    for (const [totalSeconds, expectedStatus] of [
        [4499, "Limited PP opportunity"],
        [4500, "Eligible"],
        [4501, "Eligible"]
    ]) {
        const [result] = buildPowerPlayReference(
            [{ ...player, ppPoints: 1 }],
            [{ ...player, ppTimeOnIce: totalSeconds }],
            20252026,
            [{ ...player, powerPlayGoalFor: 3 }]
        );

        assert.equal(result.sampleStatus, expectedStatus);

        // Keep recorded production below the eligibility cutoff.
        assert.equal(result.powerPlayPointsPerGame, 0.1);
        assert.equal(result.teamOnIcePowerPlayGoals, 3);
        assert.equal(result.teamOnIcePowerPlayGoalsPerGame, 0.3);

        // Only eligible players contribute to the baseline.
        const baselines = calculateBaselines(
            [result],
            ["teamOnIcePowerPlayGoalsPerGame"]
        );

        if (expectedStatus === "Eligible") {
            assert.equal(baselines.length, 1);
            assert.equal(baselines[0].eligiblePlayers, 1);
            assert.equal(baselines[0].mean, 0.3);
            assert.equal(baselines[0].scalingStatus, "Unavailable");
        } else {
            assert.equal(baselines.length, 0);
        }
    }
});

test("history averages eligible indices equally, not by playing time", () => {
    const records = [
        {
            playerId: "1",
            player: "Example Player",
            position: "C",
            season: "20232024",
            gamesPlayed: "20",
            estimatedMinutes5v5: "200",
            fiveOnFiveScore: 0.8,
            powerPlayContribution: 0.2,
            offensiveIndex: 1
        },
        {
            playerId: "1",
            player: "Example Player",
            position: "C",
            season: "20242025",
            gamesPlayed: "80",
            estimatedMinutes5v5: "1200",
            fiveOnFiveScore: 2.6,
            powerPlayContribution: 0.4,
            offensiveIndex: 3
        },
        {
            playerId: "1",
            player: "Example Player",
            position: "C",
            season: "20252026",
            gamesPlayed: "2",
            estimatedMinutes5v5: "30",
            fiveOnFiveScore: null,
            powerPlayContribution: null,
            offensiveIndex: null
        }
    ];

    const [result] = buildHistoricalScores(records);

    // Equal-season average: (1 + 3) / 2.
    assert.equal(result.offensiveIndex, 2);

    assert.equal(result.availableSeasons, 3);
    assert.equal(result.eligibleSeasons, 2);
    assert.equal(result.includedSeasons, "20232024,20242025");

    // All recorded exposure includes the unscored season.
    assert.equal(result.gamesPlayedInRecordedSeasons, 102);
    assert.equal(result.minutes5v5InRecordedSeasons, 1430);

    // Scoring exposure includes only eligible seasons.
    assert.equal(result.gamesPlayedInEligibleSeasons, 100);
    assert.equal(result.minutes5v5InEligibleSeasons, 1400);
});

test("a player with no eligible history remains unrated", () => {
    const records = [
        {
            playerId: "2",
            player: "Limited Sample Player",
            position: "D",
            season: "20252026",
            gamesPlayed: "6",
            estimatedMinutes5v5: "75",
            fiveOnFiveScore: null,
            powerPlayContribution: null,
            offensiveIndex: null
        }
    ];

    const history = buildHistoricalScores(records);

    const [result] = addPercentileRatings(
        history,
        (record) => record.position,
        "offensiveIndex"
    );

    assert.equal(result.eligibleSeasons, 0);
    assert.equal(result.gamesPlayedInRecordedSeasons, 6);
    assert.equal(result.minutes5v5InRecordedSeasons, 75);
    assert.equal(result.gamesPlayedInEligibleSeasons, 0);

    assert.equal(result.offensiveIndex, null);
    assert.equal(result.percentile, null);
    assert.equal(result.offenseRating, null);
});

test("baselines accept zero and calculate population statistics", () => {
    const rows = [0, 2].map((value, index) => ({
        season: 20252026,
        playerId: index + 1,
        position: "D",
        sampleStatus: "Eligible",
        exampleMetric: value
    }));

    const [baseline] = calculateBaselines(rows, ["exampleMetric"]);

    assert.equal(baseline.eligiblePlayers, 2);
    assert.equal(baseline.mean, 1);
    assert.equal(baseline.populationStandardDeviation, 1);
    assert.equal(baseline.scalingStatus, "Available");
});

test("baselines reject invalid eligible values with useful context", () => {
    for (const value of [
        undefined, null, "", "2", NaN, Infinity, -Infinity
    ]) {
        const row = {
            season: 20252026,
            playerId: 123,
            position: "D",
            sampleStatus: "Eligible",
            exampleMetric: value
        };

        assert.throws(
            () => calculateBaselines([row], ["exampleMetric"]),
            /Invalid baseline input: exampleMetric for player 123, season 20252026, position D/
        );
    }
});

test("team PP reference validates goals and matching reports", () => {
    const player = {
        playerId: 1,
        seasonId: 20252026,
        skaterFullName: "Example Player",
        positionCode: "C",
        gamesPlayed: 10
    };

    function build(teamGoals, seconds = 4500, overrides = {}) {
        return buildPowerPlayReference(
            [{ ...player, ppPoints: 0 }],
            [{ ...player, ppTimeOnIce: seconds }],
            20252026,
            [{
                ...player,
                powerPlayGoalFor: teamGoals,
                ...overrides
            }]
        )[0];
    }

    // Zero is valid and remains available for comparison.
    assert.equal(build(0).teamOnIcePowerPlayGoalsPerGame, 0);

    // Missing data is preserved below the cutoff.
    const limited = build(null, 4499);
    assert.equal(limited.teamOnIcePowerPlayGoalsPerGame, null);
    assert.match(limited.dataStatus, /Team PP goals unavailable/);

    // Eligible players must have recorded team-goal data.
    assert.throws(
        () => build(null),
        /Missing team PP goals for eligible player/
    );

    for (const value of [-1, 1.5, "3", NaN, Infinity]) {
        assert.throws(
            () => build(value),
            /Invalid team PP goals/
        );
    }

    assert.throws(
        () => build(1, 0),
        /Team PP goals recorded without PP time/
    );

    assert.throws(
        () => build(1, 4500, { positionCode: "D" }),
        /Position or games mismatch/
    );

    assert.throws(
        () => build(1, 4500, { gamesPlayed: 9 }),
        /Position or games mismatch/
    );

    assert.throws(
        () => build(1, 4500, { playerId: 2 }),
        /Report coverage differs/
    );
});

test("SH samples preserve production and use their own 75-minute cutoff", () => {
    const player = {
        playerId: 1,
        seasonId: 20252026,
        skaterFullName: "Example Player",
        positionCode: "C",
        gamesPlayed: 10
    };

    function build(seconds, goals, fiveOnFiveSeconds = 1000) {
        return buildTeamReference(
            [{
                ...player,
                timeOnIcePerGame5v5: fiveOnFiveSeconds,
                usatFor: 50
            }],
            [{
                ...player,
                evenStrengthGoalsFor: 3,
                shortHandedGoalsFor: goals
            }],
            [{
                ...player,
                evTimeOnIce: 10000,
                shTimeOnIce: seconds
            }],
            20252026
        )[0];
    }

    for (const [seconds, status] of [
        [4499, "Limited SH opportunity"],
        [4500, "Eligible"],
        [4501, "Eligible"]
    ]) {
        const result = build(seconds, 2);

        assert.equal(result.shortHandedSampleStatus, status);
        assert.equal(result.teamOnIceShortHandedGoals, 2);
        assert.equal(result.teamOnIceShortHandedGoalsPerGame, 0.2);
        assert.equal(result.shortHandedTimePerGame, "7:30");
    }

    // SH eligibility is independent of five-on-five eligibility.
    const limitedFiveOnFive = build(4500, 2, 300);
    assert.equal(limitedFiveOnFive.sampleStatus, "Limited sample");
    assert.equal(limitedFiveOnFive.shortHandedSampleStatus, "Eligible");

    assert.equal(build(0, 0).shortHandedSampleStatus, "No SH opportunity");
    assert.equal(build(0, 0).teamOnIceShortHandedGoalsPerGame, 0);

    const missing = build(4499, null);
    assert.equal(missing.teamOnIceShortHandedGoalsPerGame, null);
    assert.equal(missing.shortHandedDataStatus, "Team SH goals unavailable");

    assert.throws(
        () => build(4500, null),
        /Missing team SH goals for eligible player/
    );

    for (const goals of [-1, 1.5, "2", NaN, Infinity]) {
        assert.throws(() => build(4500, goals), /Invalid team SH goals/);
    }

    assert.throws(
        () => build(0, 1),
        /Team SH goals recorded without SH time/
    );

    for (const seconds of [null, -1, NaN, Infinity]) {
        assert.throws(() => build(seconds, 0), /Invalid SH ice time/);
    }
});