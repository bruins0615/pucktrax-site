const test = require("node:test");
const assert = require("node:assert/strict");

const {
    calculateCorePerformanceIndex
} = require("../scripts/models/calculate-core-performance-ratings");

test("core performance applies 75/25 weights to underlying indices", () => {
    const result = calculateCorePerformanceIndex(2, -1);

    assert.equal(result.offensiveContribution, 1.5);
    assert.equal(result.defensiveContribution, -0.25);
    assert.equal(result.corePerformanceIndex, 1.25);
});

test("zero indices are valid and produce a scored zero", () => {
    const result = calculateCorePerformanceIndex(0, 0);

    assert.equal(result.corePerformanceIndex, 0);
    assert.equal(result.offensiveContribution, 0);
    assert.equal(result.defensiveContribution, 0);
});

test("missing indices remain ungraded without redistributing weights", () => {
    for (const [offense, defense] of [
        [null, 1],
        [1, null],
        [null, null]
    ]) {
        const result = calculateCorePerformanceIndex(offense, defense);

        assert.equal(result.corePerformanceIndex, null);
        assert.equal(result.offensiveContribution, null);
        assert.equal(result.defensiveContribution, null);
    }
});

test("negative combined performance is preserved", () => {
    const result = calculateCorePerformanceIndex(-2, 1);

    assert.equal(result.corePerformanceIndex, -1.25);
});

test("invalid indices are rejected rather than treated as missing", () => {
    for (const value of [undefined, "", "2", NaN, Infinity, -Infinity]) {
        assert.throws(
            () => calculateCorePerformanceIndex(value, 1),
            /Invalid offensive index/
        );

        assert.throws(
            () => calculateCorePerformanceIndex(1, value),
            /Invalid defensive index/
        );
    }
});

const {
    buildCorePerformanceHistoricalScores
} = require("../scripts/models/calculate-core-performance-ratings");

function coreHistoryFixture(overrides = {}) {
    return {
        playerId: "1",
        player: "Example Player",
        position: "C",
        windowStart: "20232024",
        windowEnd: "20252026",
        eligibleSeasons: "2",
        includedSeasons: "20242025,20252026",
        gamesPlayedInEligibleSeasons: "150",
        minutes5v5InEligibleSeasons: "2000",
        offensiveIndex: "2",
        defensiveIndex: "-1",
        ...overrides
    };
}

test("historical core joins matching coverage and accepts CSV numbers", () => {
    const [result] = buildCorePerformanceHistoricalScores(
        [coreHistoryFixture()],
        [coreHistoryFixture({
            includedSeasons: "20252026,20242025"
        })]
    );

    assert.equal(result.corePerformanceIndex, 1.25);
    assert.equal(result.eligibleSeasons, 2);
    assert.equal(result.historyStatus, "Eligible");
    assert.equal(result.comparisonGroupSize, 1);
    assert.equal(result.corePerformanceRating, 5);
});

test("mismatched positions or included seasons remain ungraded", () => {
    for (const [overrides, expectedStatus] of [
        [{ position: "L" }, "Position mismatch"],
        [{
            includedSeasons: "20232024,20242025"
        }, "Season coverage mismatch"]
    ]) {
        const [result] = buildCorePerformanceHistoricalScores(
            [coreHistoryFixture()],
            [coreHistoryFixture(overrides)]
        );

        assert.equal(result.corePerformanceIndex, null);
        assert.equal(result.corePerformanceRating, null);
        assert.equal(result.historyStatus, expectedStatus);
    }
});

test("missing category and no eligible history remain distinct", () => {
    const [missing] = buildCorePerformanceHistoricalScores(
        [coreHistoryFixture()],
        []
    );

    assert.equal(missing.historyStatus, "Missing category history");
    assert.equal(missing.corePerformanceRating, null);

    const unrated = coreHistoryFixture({
        eligibleSeasons: "0",
        includedSeasons: "",
        offensiveIndex: "",
        defensiveIndex: ""
    });

    const [result] = buildCorePerformanceHistoricalScores(
        [unrated],
        [unrated]
    );

    assert.equal(result.historyStatus, "No eligible history");
    assert.equal(result.corePerformanceRating, null);
});

test("combined percentiles use positional pools and midpoint ties", () => {
    const records = [
        coreHistoryFixture({
            playerId: "1",
            offensiveIndex: "0",
            defensiveIndex: "0"
        }),
        coreHistoryFixture({
            playerId: "2",
            offensiveIndex: "0",
            defensiveIndex: "0"
        }),
        coreHistoryFixture({
            playerId: "3",
            offensiveIndex: "2",
            defensiveIndex: "2"
        }),
        coreHistoryFixture({
            playerId: "4",
            position: "D",
            offensiveIndex: "2",
            defensiveIndex: "2"
        })
    ];

    const results = buildCorePerformanceHistoricalScores(
        records,
        records
    );

    assert.equal(results[0].comparisonGroupSize, 3);
    assert.equal(results[0].corePerformanceRating, 3.3);
    assert.equal(results[1].corePerformanceRating, 3.3);
    assert.equal(results[2].corePerformanceRating, 8.3);
    assert.equal(results[3].comparisonGroupSize, 1);
    assert.equal(results[3].corePerformanceRating, 5);
});

test("duplicate players and invalid historical coverage are rejected", () => {
    const record = coreHistoryFixture();

    assert.throws(
        () => buildCorePerformanceHistoricalScores(
            [record, record],
            [record]
        ),
        /Invalid or duplicate offensive player/
    );

    assert.throws(
        () => buildCorePerformanceHistoricalScores(
            [coreHistoryFixture({ windowStart: "20222023" })],
            [record]
        ),
        /Unexpected offensive historical window/
    );

    assert.throws(
        () => buildCorePerformanceHistoricalScores(
            [coreHistoryFixture({ eligibleSeasons: "3" })],
            [record]
        ),
        /Invalid offensive season coverage/
    );
});