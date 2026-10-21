const test = require("node:test");
const assert = require("node:assert/strict");

const {
    calculateDefensiveSeasonScore
} = require("../scripts/models/calculate-defensive-ratings");

const {
    baselineKey
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
        estimatedMinutes5v5: "150",
        evenStrengthMinutes: "180",
        allSituationsMinutes: "200",
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

test("defensive eligibility begins at exactly 150 five-on-five minutes", () => {
    for (const minutes of [149.999, 150, 150.001]) {
        const { record, baselines } = fixture({
            estimatedMinutes5v5: String(minutes)
        });

        const result = calculateDefensiveSeasonScore(record, baselines);

        if (minutes < 150) {
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