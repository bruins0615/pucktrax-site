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

const {
    calculateHistoricalFaceoffAdjustment
} = require("../scripts/models/calculate-performance-ratings");

function faceoffCoreFixture(overrides = {}) {
    return {
        playerId: "1",
        eligibleSeasons: "3",
        includedSeasons: "20232024,20242025,20252026",
        ...overrides
    };
}

function faceoffSeasonFixture(season, overrides = {}) {
    return {
        playerId: "1",
        season,
        sampleStatus: "Eligible",
        faceoffIndex: "1",
        ...overrides
    };
}

test("Faceoff adjustment averages signed season contributions equally", () => {
    const result = calculateHistoricalFaceoffAdjustment(
        faceoffCoreFixture(),
        [
            faceoffSeasonFixture("20232024", { faceoffIndex: "2" }),
            faceoffSeasonFixture("20242025", { faceoffIndex: "-1" }),
            faceoffSeasonFixture("20252026", { faceoffIndex: "0" })
        ]
    );

    assert.equal(result.faceoffSupportedSeasons, 3);
    assert.equal(result.faceoffAdjustment, (0.05 - 0.025 + 0) / 3);
});

test("partial Faceoff support uses all qualifying Core seasons as denominator", () => {
    const result = calculateHistoricalFaceoffAdjustment(
        faceoffCoreFixture(),
        [
            faceoffSeasonFixture("20232024", { faceoffIndex: "0.9" }),
            faceoffSeasonFixture("20242025", {
                sampleStatus: "Incomplete zone sample",
                faceoffIndex: ""
            }),
            faceoffSeasonFixture("20252026", {
                sampleStatus: "Limited sample",
                faceoffIndex: ""
            })
        ]
    );

    assert.equal(result.faceoffSupportedSeasons, 1);
    assert.equal(result.faceoffIncludedSeasons, "20232024");
    assert.equal(result.faceoffAdjustment, 0.025 * 0.9 / 3);
});

test("documented non-taker seasons receive no Faceoff adjustment", () => {
    const result = calculateHistoricalFaceoffAdjustment(
        faceoffCoreFixture(),
        ["20232024", "20242025", "20252026"].map((season) =>
            faceoffSeasonFixture(season, {
                sampleStatus: "Not applicable",
                faceoffIndex: ""
            })
        )
    );

    assert.equal(result.faceoffSupportedSeasons, 0);
    assert.equal(result.faceoffIncludedSeasons, "");
    assert.equal(result.faceoffAdjustment, 0);
});

test("missing or duplicate Faceoff records fail rather than becoming zero", () => {
    const core = faceoffCoreFixture({
        eligibleSeasons: "1",
        includedSeasons: "20252026"
    });

    assert.throws(
        () => calculateHistoricalFaceoffAdjustment(core, []),
        /Missing faceoff record/
    );

    const record = faceoffSeasonFixture("20252026");

    assert.throws(
        () => calculateHistoricalFaceoffAdjustment(core, [record, record]),
        /Duplicate faceoff record/
    );
});

test("invalid Faceoff status and contradictory index availability fail", () => {
    const core = faceoffCoreFixture({
        eligibleSeasons: "1",
        includedSeasons: "20252026"
    });

    assert.throws(
        () => calculateHistoricalFaceoffAdjustment(core, [
            faceoffSeasonFixture("20252026", { sampleStatus: "Unknown" })
        ]),
        /Invalid faceoff status/
    );

    assert.throws(
        () => calculateHistoricalFaceoffAdjustment(core, [
            faceoffSeasonFixture("20252026", { faceoffIndex: "" })
        ]),
        /Missing/
    );

    assert.throws(
        () => calculateHistoricalFaceoffAdjustment(core, [
            faceoffSeasonFixture("20252026", {
                sampleStatus: "Incomplete zone sample"
            })
        ]),
        /Ungraded faceoff season has an index/
    );
});

test("Faceoff adjustment uses only the player's qualifying Core seasons", () => {
    const result = calculateHistoricalFaceoffAdjustment(
        faceoffCoreFixture({
            eligibleSeasons: "1",
            includedSeasons: "20252026"
        }),
        [
            faceoffSeasonFixture("20232024", { faceoffIndex: "10" }),
            faceoffSeasonFixture("20252026", { faceoffIndex: "-2" }),
            faceoffSeasonFixture("20252026", {
                playerId: "2",
                faceoffIndex: "10"
            })
        ]
    );

    assert.equal(result.faceoffSupportedSeasons, 1);
    assert.equal(result.faceoffAdjustment, -0.05);
});

const {
    applyHistoricalFaceoffAdjustments
} = require("../scripts/models/calculate-performance-ratings");

test("Faceoff integration preserves Core and averages partial support correctly", () => {
    const base = buildPerformanceHistoricalScores(
        [performanceHistoryFixture()],
        [performanceHistoryFixture()]
    );

    const [result] = applyHistoricalFaceoffAdjustments(base, [
        faceoffSeasonFixture("20242025", {
            faceoffIndex: "-2"
        }),
        faceoffSeasonFixture("20252026", {
            sampleStatus: "Incomplete zone sample",
            faceoffIndex: ""
        })
    ]);

    assert.equal(result.corePerformanceIndex, 1);
    assert.equal(result.corePerformanceRating, "8.0");
    assert.equal(result.disciplineAdjustment, 0.05);
    assert.equal(result.performanceBeforeFaceoffsIndex, 1.05);
    assert.equal(result.performanceBeforeFaceoffsRating, 5);
    assert.equal(result.faceoffSupportedSeasons, 1);
    assert.equal(result.faceoffAdjustment, -0.025);
    assert.equal(result.performanceIndex, 1.05 - 0.025);
    assert.equal(result.performanceRating, 5);
});

test("Faceoff integration rejects missing eligible coverage but retains ungraded players", () => {
    const base = buildPerformanceHistoricalScores(
        [performanceHistoryFixture()],
        [performanceHistoryFixture()]
    );

    assert.throws(
        () => applyHistoricalFaceoffAdjustments(base, []),
        /Missing faceoff record/
    );

    const empty = performanceHistoryFixture({
        eligibleSeasons: "0",
        includedSeasons: "",
        corePerformanceIndex: "",
        corePerformanceRating: "",
        disciplineIndex: ""
    });

    const ungraded = buildPerformanceHistoricalScores([empty], [empty]);
    const [result] = applyHistoricalFaceoffAdjustments(ungraded, []);

    assert.equal(result.performanceIndex, null);
    assert.equal(result.performanceRating, null);
    assert.equal(result.faceoffAdjustment, null);
    assert.equal(result.faceoffSupportedSeasons, null);
});

const {
    calculateHistoricalPhysicalityBonus
} = require("../scripts/models/calculate-performance-ratings");

function physicalitySeasonFixture(season, overrides = {}) {
    return {
        playerId: "1",
        season,
        sampleStatus: "Eligible",
        physicalityBonus: "0.05",
        ...overrides
    };
}

test("historical Physicality averages saved bonuses including valid zeros", () => {
    const result = calculateHistoricalPhysicalityBonus(
        faceoffCoreFixture(),
        [
            physicalitySeasonFixture("20232024", {
                physicalityBonus: "0.25"
            }),
            physicalitySeasonFixture("20242025", {
                physicalityBonus: "0"
            }),
            physicalitySeasonFixture("20252026", {
                physicalityBonus: "0.05"
            })
        ]
    );

    assert.equal(result.historicalPhysicalityBonus, (0.25 + 0 + 0.05) / 3);
    assert.equal(result.physicalitySupportedSeasons, 3);
    assert.equal(result.physicalityPositiveSeasons, 2);
});

test("historical Physicality uses only qualifying Core seasons and the correct player", () => {
    const result = calculateHistoricalPhysicalityBonus(
        faceoffCoreFixture({
            eligibleSeasons: "1",
            includedSeasons: "20252026"
        }),
        [
            physicalitySeasonFixture("20232024", {
                physicalityBonus: "0.25"
            }),
            physicalitySeasonFixture("20252026"),
            physicalitySeasonFixture("20252026", {
                playerId: "2",
                physicalityBonus: "0.25"
            })
        ]
    );

    assert.equal(result.historicalPhysicalityBonus, 0.05);
    assert.equal(result.physicalitySupportedSeasons, 1);
    assert.equal(result.physicalityIncludedSeasons, "20252026");
});

test("missing and duplicate Physicality records fail", () => {
    const core = faceoffCoreFixture({
        eligibleSeasons: "1",
        includedSeasons: "20252026"
    });

    assert.throws(
        () => calculateHistoricalPhysicalityBonus(core, []),
        /Missing Physicality record/
    );

    const record = physicalitySeasonFixture("20252026");

    assert.throws(
        () => calculateHistoricalPhysicalityBonus(core, [record, record]),
        /Duplicate Physicality record/
    );
});

test("invalid Physicality bonuses and conflicting eligibility fail", () => {
    const core = faceoffCoreFixture({
        eligibleSeasons: "1",
        includedSeasons: "20252026"
    });

    for (const value of ["", null, undefined, "invalid", -0.01, 0.26]) {
        assert.throws(
            () => calculateHistoricalPhysicalityBonus(core, [
                physicalitySeasonFixture("20252026", {
                    physicalityBonus: value
                })
            ]),
            /Missing number|Invalid number|outside cap/
        );
    }

    assert.throws(
        () => calculateHistoricalPhysicalityBonus(core, [
            physicalitySeasonFixture("20252026", {
                sampleStatus: "Limited sample"
            })
        ]),
        /eligibility differs from Core/
    );
});

const {
    applyHistoricalPhysicalityBonuses
} = require("../scripts/models/calculate-performance-ratings");

test("Physicality integration adds the historical bonus once and preserves prior results", () => {
    const base = buildPerformanceHistoricalScores(
        [performanceHistoryFixture()],
        [performanceHistoryFixture()]
    );

    const withFaceoffs = applyHistoricalFaceoffAdjustments(base, [
        faceoffSeasonFixture("20242025", { faceoffIndex: "0" }),
        faceoffSeasonFixture("20252026", { faceoffIndex: "0" })
    ]);

    const [result] = applyHistoricalPhysicalityBonuses(
        withFaceoffs,
        [
            physicalitySeasonFixture("20242025", {
                physicalityBonus: "0.1"
            }),
            physicalitySeasonFixture("20252026", {
                physicalityBonus: "0"
            })
        ]
    );

    assert.equal(result.corePerformanceIndex, 1);
    assert.equal(result.disciplineAdjustment, 0.05);
    assert.equal(result.faceoffAdjustment, 0);
    assert.equal(result.performanceBeforePhysicalityIndex, 1.05);
    assert.equal(result.performanceBeforePhysicalityRating, 5);
    assert.equal(result.historicalPhysicalityBonus, 0.05);
    assert.equal(result.physicalitySupportedSeasons, 2);
    assert.equal(result.physicalityPositiveSeasons, 1);
    assert.equal(result.performanceIndex, 1.05 + 0.05);
    assert.equal(result.performanceRating, 5);
});

test("Physicality integration rejects missing coverage and preserves ungraded players", () => {
    const base = buildPerformanceHistoricalScores(
        [performanceHistoryFixture()],
        [performanceHistoryFixture()]
    );

    assert.throws(
        () => applyHistoricalPhysicalityBonuses(base, []),
        /Missing Physicality record/
    );

    const empty = performanceHistoryFixture({
        eligibleSeasons: "0",
        includedSeasons: "",
        corePerformanceIndex: "",
        corePerformanceRating: "",
        disciplineIndex: ""
    });

    const ungraded = buildPerformanceHistoricalScores([empty], [empty]);
    const [result] = applyHistoricalPhysicalityBonuses(ungraded, []);

    assert.equal(result.performanceIndex, null);
    assert.equal(result.performanceRating, null);
    assert.equal(result.historicalPhysicalityBonus, null);
    assert.equal(result.physicalitySupportedSeasons, null);
});