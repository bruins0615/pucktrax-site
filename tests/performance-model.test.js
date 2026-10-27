const test = require("node:test");
const assert = require("node:assert/strict");

const {
    calculatePerformanceIndex
} = require("../scripts/models/calculate-performance-ratings");

test("positive Discipline adds 0.025 times its underlying index", () => {
    const result = calculatePerformanceIndex(1, 2);

    assert.equal(result.disciplineAdjustment, 0.05);
    assert.equal(result.performanceIndex, 1.05);
});

test("negative Discipline deducts from the performance index", () => {
    const result = calculatePerformanceIndex(1, -4);

    assert.equal(result.disciplineAdjustment, -0.1);
    assert.equal(result.performanceIndex, 0.9);
});

test("zero is valid and negative combined results are preserved", () => {
    const zero = calculatePerformanceIndex(0, 0);

    assert.equal(zero.disciplineAdjustment, 0);
    assert.equal(zero.performanceIndex, 0);

    const negative = calculatePerformanceIndex(-1, -4);

    assert.equal(negative.performanceIndex, -1.1);
});

test("missing inputs remain ungraded", () => {
    for (const [core, discipline] of [
        [null, 1],
        [1, null],
        [null, null]
    ]) {
        const result = calculatePerformanceIndex(core, discipline);

        assert.equal(result.disciplineAdjustment, null);
        assert.equal(result.performanceIndex, null);
    }
});

test("invalid inputs are rejected rather than treated as missing", () => {
    for (const value of [undefined, "", "2", NaN, Infinity, -Infinity]) {
        assert.throws(
            () => calculatePerformanceIndex(value, 1),
            /Invalid core index/
        );

        assert.throws(
            () => calculatePerformanceIndex(1, value),
            /Invalid discipline index/
        );
    }
});

const {
    buildPerformanceHistoricalScores
} = require("../scripts/models/calculate-performance-ratings");

function performanceHistoryFixture(overrides = {}) {
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
        corePerformanceIndex: "1",
        corePerformanceRating: "8.0",
        disciplineIndex: "2",
        ...overrides
    };
}

test("historical Performance joins matching seasons and preserves Core", () => {
    const [result] = buildPerformanceHistoricalScores(
        [performanceHistoryFixture()],
        [performanceHistoryFixture({
            includedSeasons: "20252026,20242025"
        })]
    );

    assert.equal(result.corePerformanceIndex, 1);
    assert.equal(result.corePerformanceRating, "8.0");
    assert.equal(result.disciplineAdjustment, 0.05);
    assert.equal(result.performanceIndex, 1.05);
    assert.equal(result.eligibleSeasons, 2);
    assert.equal(result.historyStatus, "Eligible");
    assert.equal(result.performanceRating, 5);
});

test("Performance flags mismatched positions and seasons", () => {
    for (const [overrides, expectedStatus] of [
        [{ position: "D" }, "Position mismatch"],
        [{
            includedSeasons: "20232024,20242025"
        }, "Season coverage mismatch"]
    ]) {
        const [result] = buildPerformanceHistoricalScores(
            [performanceHistoryFixture()],
            [performanceHistoryFixture(overrides)]
        );

        assert.equal(result.historyStatus, expectedStatus);
        assert.equal(result.performanceIndex, null);
        assert.equal(result.performanceRating, null);
        assert.equal(result.corePerformanceIndex, 1);
    }
});

test("missing Discipline leaves Performance ungraded and preserves Core", () => {
    const [result] = buildPerformanceHistoricalScores(
        [performanceHistoryFixture()],
        []
    );

    assert.equal(result.historyStatus, "Missing category history");
    assert.equal(result.corePerformanceIndex, 1);
    assert.equal(result.corePerformanceRating, "8.0");
    assert.equal(result.disciplineAdjustment, null);
    assert.equal(result.performanceRating, null);
});

test("Performance percentiles use adjusted indices and positional pools", () => {
    const records = [
        performanceHistoryFixture({
            playerId: "1",
            disciplineIndex: "-2"
        }),
        performanceHistoryFixture({
            playerId: "2",
            disciplineIndex: "2"
        }),
        performanceHistoryFixture({
            playerId: "3",
            disciplineIndex: "2"
        }),
        performanceHistoryFixture({
            playerId: "4",
            position: "D"
        })
    ];

    const results = buildPerformanceHistoricalScores(records, records);

    assert.equal(results[0].comparisonGroupSize, 3);
    assert.equal(results[0].performanceRating, 1.7);
    assert.equal(results[1].performanceRating, 6.7);
    assert.equal(results[2].performanceRating, 6.7);
    assert.equal(results[3].comparisonGroupSize, 1);
    assert.equal(results[3].performanceRating, 5);
});

test("empty histories remain ungraded and malformed coverage is rejected", () => {
    const empty = performanceHistoryFixture({
        eligibleSeasons: "0",
        includedSeasons: "",
        corePerformanceIndex: "",
        corePerformanceRating: "",
        disciplineIndex: ""
    });

    const [result] = buildPerformanceHistoricalScores([empty], [empty]);

    assert.equal(result.historyStatus, "No eligible matched history");
    assert.equal(result.performanceRating, null);

    const record = performanceHistoryFixture();

    assert.throws(
        () => buildPerformanceHistoricalScores([record, record], [record]),
        /Invalid or duplicate core player/
    );

    assert.throws(
        () => buildPerformanceHistoricalScores(
            [record],
            [performanceHistoryFixture({ eligibleSeasons: "3" })]
        ),
        /Invalid discipline season coverage/
    );

    assert.throws(
        () => buildPerformanceHistoricalScores(
            [performanceHistoryFixture({ windowStart: "20222023" })],
            [record]
        ),
        /Unexpected core historical window/
    );
});