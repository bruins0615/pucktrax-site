const test = require("node:test");
const assert = require("node:assert/strict");

const {
    calculateDefensiveSeasonScore
} = require("../scripts/models/calculate-defensive-ratings");

const {
    baselineKey,
    addPercentileRatings,
    buildHistoricalScores
} = require("../scripts/models/calculate-offensive-ratings");

const UNBLOCKED =
    "teamEstimatedOnIceUnblockedAttemptsAgainstPer60_5v5";
const GOALS = "teamOnIceGoalsAgainstPer60EvenStrength";
const BLOCKS = "individualBlockedShotsPer60AllSituations";
const TAKEAWAYS = "individualTakeawaysPer60AllSituations";

function fixture(overrides = {}) {
    const record = {
        season: "20252026",
        playerId: "1",
        player: "Example Player",
        position: "D",
        gamesPlayed: "10",
        estimatedMinutes5v5: "300",
        evenStrengthMinutes: "330",
        allSituationsMinutes: "400",
        [UNBLOCKED]: "35",
        [GOALS]: "3.5",
        [BLOCKS]: "4",
        [TAKEAWAYS]: "1",
        ...overrides
    };

    const baselines = new Map([
        [
            baselineKey(record.season, record.position, UNBLOCKED),
            {
                mean: "40",
                populationStandardDeviation: "5",
                scalingStatus: "Available"
            }
        ],
        [
            baselineKey(record.season, record.position, GOALS),
            {
                mean: "3",
                populationStandardDeviation: "0.5",
                scalingStatus: "Available"
            }
        ]
    ]);

    return { record, baselines };
}

function score(overrides = {}) {
    const { record, baselines } = fixture(overrides);
    return calculateDefensiveSeasonScore(record, baselines);
}

function close(actual, expected) {
    assert.ok(
        Math.abs(actual - expected) < 1e-12,
        `Expected ${actual} to equal ${expected}`
    );
}

test("defense applies the 70/30 foundation and positive bonuses", () => {
    const result = score();

    // Suppression values are +1 for attempts and -1 for goals.
    close(result.defensiveFoundation, 0.4);
    close(result.blockBonus, 0.2);
    close(result.takeawayBonus, 0.025);
    close(result.defensiveIndex, 0.625);
});

test("fewer opposing events improve the defensive index", () => {
    close(score({ [UNBLOCKED]: "30" }).defensiveIndex, 1.325);
    close(score({ [GOALS]: "3" }).defensiveIndex, 0.925);
});

test("zero actions earn zero bonus without a deduction", () => {
    const result = score({
        [BLOCKS]: "0",
        [TAKEAWAYS]: "0"
    });

    assert.equal(result.blockBonus, 0);
    assert.equal(result.takeawayBonus, 0);
    close(result.defensiveIndex, result.defensiveFoundation);
});

test("defensive eligibility begins at exactly 300 five-on-five minutes", () => {
    for (const minutes of [299.999, 300, 300.001]) {
        const { record, baselines } = fixture({
            estimatedMinutes5v5: String(minutes)
        });

        const result = calculateDefensiveSeasonScore(record, baselines);

        if (minutes < 300) {
            assert.equal(result.sampleStatus, "Limited sample");
            assert.equal(result.defensiveIndex, null);
            assert.equal(result.blockBonus, null);
            assert.equal(result.takeawayBonus, null);
            assert.equal(result.gamesPlayed, "10");
        } else {
            assert.equal(result.sampleStatus, "Eligible");
            close(result.defensiveIndex, 0.625);
        }
    }
});

test("missing or invalid eligible scoring inputs are rejected", () => {
    for (const metric of [UNBLOCKED, GOALS, BLOCKS, TAKEAWAYS]) {
        for (const value of ["", " ", null, undefined, "invalid", -1]) {
            assert.throws(
                () => score({ [metric]: value }),
                /Missing number:|Invalid number:|Negative number:/
            );
        }
    }
});

test("missing or unusable defensive baselines are rejected", () => {
    const { record, baselines } = fixture();

    assert.throws(
        () => calculateDefensiveSeasonScore(record, new Map()),
        /Unavailable defensive baseline/
    );

    const key = baselineKey(record.season, record.position, UNBLOCKED);

    baselines.set(key, {
        mean: "40",
        populationStandardDeviation: "0",
        scalingStatus: "Available"
    });

    assert.throws(
        () => calculateDefensiveSeasonScore(record, baselines),
        /Invalid defensive standard deviation/
    );

    baselines.set(key, {
        mean: "40",
        populationStandardDeviation: "5",
        scalingStatus: "Unavailable"
    });

    assert.throws(
        () => calculateDefensiveSeasonScore(record, baselines),
        /Unavailable defensive baseline/
    );
});

test("defense and offense share percentile and tie behavior", () => {
    const values = [0, 1, 1, 3, null];

    const offense = addPercentileRatings(
        values.map((value) => ({
            position: "D",
            offensiveIndex: value
        })),
        (record) => record.position,
        "offensiveIndex"
    );

    const defense = addPercentileRatings(
        values.map((value) => ({
            position: "D",
            defensiveIndex: value
        })),
        (record) => record.position,
        "defensiveIndex",
        "defenseRating"
    );

    assert.deepEqual(
        defense.map((record) => record.percentile),
        [12.5, 50, 50, 87.5, null]
    );

    assert.deepEqual(
        defense.map((record) => record.defenseRating),
        offense.map((record) => record.offenseRating)
    );

    assert.equal(defense[4].comparisonGroupSize, null);
    assert.equal(Object.hasOwn(defense[0], "offenseRating"), false);
});

test("defensive history averages eligible indices equally within the window", () => {
    const common = {
        playerId: "1",
        player: "Example Player",
        position: "D"
    };

    const records = [
        {
            ...common,
            season: "20232024",
            gamesPlayed: 20,
            estimatedMinutes5v5: 200,
            defensiveFoundation: 0.8,
            blockBonus: 0.15,
            takeawayBonus: 0.05,
            defensiveIndex: 1
        },
        {
            ...common,
            season: "20242025",
            gamesPlayed: 80,
            estimatedMinutes5v5: 1200,
            defensiveFoundation: 2.6,
            blockBonus: 0.3,
            takeawayBonus: 0.1,
            defensiveIndex: 3
        },
        {
            ...common,
            position: "C",
            season: "20252026",
            gamesPlayed: 2,
            estimatedMinutes5v5: 30,
            defensiveFoundation: null,
            blockBonus: null,
            takeawayBonus: null,
            defensiveIndex: null
        },
        {
            ...common,
            position: "R",
            season: "20262027",
            gamesPlayed: 40,
            estimatedMinutes5v5: 600,
            defensiveFoundation: 99,
            blockBonus: 0,
            takeawayBonus: 0,
            defensiveIndex: 99
        }
    ];

    const [history] = buildHistoricalScores(
        records,
        "defensiveIndex",
        ["defensiveFoundation", "blockBonus", "takeawayBonus"]
    );

    close(history.defensiveIndex, 2);
    close(history.defensiveFoundation, 1.7);
    close(history.blockBonus, 0.225);
    close(history.takeawayBonus, 0.075);

    assert.equal(history.availableSeasons, 3);
    assert.equal(history.eligibleSeasons, 2);
    assert.equal(history.includedSeasons, "20232024,20242025");
    assert.equal(history.position, "C");
    assert.equal(history.gamesPlayedInRecordedSeasons, 102);
    assert.equal(history.minutes5v5InRecordedSeasons, 1430);
    assert.equal(history.gamesPlayedInEligibleSeasons, 100);
    assert.equal(history.minutes5v5InEligibleSeasons, 1400);
});

test("defensive history without eligible seasons remains unrated", () => {
    const history = buildHistoricalScores(
        [{
            playerId: "1",
            player: "Example Player",
            position: "D",
            season: "20252026",
            gamesPlayed: 6,
            estimatedMinutes5v5: 75,
            defensiveFoundation: null,
            blockBonus: null,
            takeawayBonus: null,
            defensiveIndex: null
        }],
        "defensiveIndex",
        ["defensiveFoundation", "blockBonus", "takeawayBonus"]
    );

    const [result] = addPercentileRatings(
        history,
        (record) => record.position,
        "defensiveIndex",
        "defenseRating"
    );

    assert.equal(result.eligibleSeasons, 0);
    assert.equal(result.gamesPlayedInRecordedSeasons, 6);
    assert.equal(result.minutes5v5InRecordedSeasons, 75);
    assert.equal(result.defensiveIndex, null);
    assert.equal(result.defenseRating, null);
});