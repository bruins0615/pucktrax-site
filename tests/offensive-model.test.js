const test = require("node:test");
const assert = require("node:assert/strict");

const {
    requireNumber,
    calculateSeasonScore,
    addPercentileRatings,
    buildHistoricalScores
} = require("../scripts/calculate-offensive-ratings");

const {
    buildReference
} = require("../scripts/collect-league-reference");

const {
    buildPowerPlayReference
} = require("../scripts/collect-powerplay-reference");

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
            20252026
        );

        assert.equal(result.sampleStatus, expectedStatus);

        // Eligibility must not erase recorded production.
        assert.equal(result.powerPlayPointsPerGame, 0.1);
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