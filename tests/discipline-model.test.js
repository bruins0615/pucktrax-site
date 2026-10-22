const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildDisciplineReference,
    DISCIPLINE_METRICS
} = require("../scripts/collectors/collect-discipline-reference");

const {
    calculateBaselines
} = require("../scripts/collectors/collect-league-reference");

const {
    calculateDisciplineSeasonScore
} = require("../scripts/models/calculate-discipline-ratings");

const {
    baselineKey,
    addPercentileRatings,
    buildHistoricalScores
} = require("../scripts/models/calculate-offensive-ratings");

const SEASON = 20252026;

function fixture(shootingOverrides = {}, penaltyOverrides = {}) {
    const identity = {
        playerId: 1,
        seasonId: SEASON,
        skaterFullName: "Example Player",
        positionCode: "D",
        gamesPlayed: 20
    };

    return {
        shooting: {
            ...identity,
            timeOnIcePerGame5v5: 900,
            ...shootingOverrides
        },
        penalty: {
            ...identity,
            penaltyMinutes: 12,
            penalties: 6,
            penaltiesDrawn: 4,
            netPenalties: -2,
            ...penaltyOverrides
        }
    };
}

function build(shootingOverrides = {}, penaltyOverrides = {}) {
    const { shooting, penalty } = fixture(
        shootingOverrides,
        penaltyOverrides
    );

    return buildDisciplineReference(
        [shooting],
        [penalty],
        SEASON
    )[0];
}

test("discipline reference uses all games as the rate denominator", () => {
    const result = build();

    assert.equal(result.estimatedMinutes5v5, 300);
    assert.equal(result.sampleStatus, "Eligible");
    assert.equal(result.penaltyMinutes, 12);
    assert.equal(result.penaltyMinutesPerGame, 0.6);
    assert.equal(result.penaltiesTaken, 6);
    assert.equal(result.penaltiesDrawn, 4);
    assert.equal(result.penaltiesDrawnPerGame, 0.2);
    assert.equal(result.netPenalties, -2);
});

test("discipline eligibility includes exactly 300 five-on-five minutes", () => {
    for (const [seconds, expected] of [
        [899.9, "Limited sample"],
        [900, "Eligible"],
        [900.1, "Eligible"]
    ]) {
        assert.equal(
            build({ timeOnIcePerGame5v5: seconds }).sampleStatus,
            expected
        );
    }
});

test("discipline preserves zero and below-cutoff missing values", () => {
    const zero = build({}, {
        penaltyMinutes: 0,
        penalties: 0,
        penaltiesDrawn: 0,
        netPenalties: 0
    });

    assert.equal(zero.penaltyMinutesPerGame, 0);
    assert.equal(zero.penaltiesDrawnPerGame, 0);
    assert.equal(zero.netPenalties, 0);

    const missing = build(
        { timeOnIcePerGame5v5: 300 },
        {
            penaltyMinutes: null,
            penalties: null,
            penaltiesDrawn: null,
            netPenalties: null
        }
    );

    assert.equal(missing.sampleStatus, "Limited sample");
    assert.equal(missing.penaltyMinutesPerGame, null);
    assert.equal(missing.penaltiesDrawnPerGame, null);
    assert.equal(missing.netPenalties, null);
});

test("eligible discipline records reject missing or invalid counts", () => {
    const fields = [
        "penaltyMinutes",
        "penalties",
        "penaltiesDrawn",
        "netPenalties"
    ];

    for (const field of fields) {
        for (const value of [null, undefined]) {
            assert.throws(
                () => build({}, { [field]: value }),
                /Missing eligible discipline input/
            );
        }

        for (const value of ["", "2", 1.5, NaN, Infinity]) {
            assert.throws(
                () => build({}, { [field]: value }),
                /Invalid discipline count/
            );
        }
    }

    for (const field of fields.filter((name) => name !== "netPenalties")) {
        assert.throws(
            () => build({}, { [field]: -1 }),
            /Invalid discipline count/
        );
    }

    assert.throws(
        () => build({}, { netPenalties: 99 }),
        /Net penalties mismatch/
    );
});

test("discipline rejects mismatched reports and invalid exposure", () => {
    for (const value of [-1, null, "900", NaN, Infinity]) {
        assert.throws(
            () => build({ timeOnIcePerGame5v5: value }),
            /Invalid five-on-five ice time/
        );
    }

    assert.throws(
        () => build({ gamesPlayed: 0 }),
        /Position or games mismatch/
    );

    assert.throws(
        () => build({}, { gamesPlayed: 19 }),
        /Position or games mismatch/
    );

    assert.throws(
        () => build({}, { positionCode: "C" }),
        /Position or games mismatch/
    );

    const { shooting, penalty } = fixture();

    assert.throws(
        () => buildDisciplineReference(
            [shooting],
            [{ ...penalty, playerId: 2 }],
            SEASON
        ),
        /Report coverage differs/
    );
});

test("discipline baselines exclude limited samples and preserve zeros", () => {
    const first = fixture({}, {
        penaltyMinutes: 0,
        penalties: 0,
        penaltiesDrawn: 0,
        netPenalties: 0
    });

    const second = fixture(
        { playerId: 2 },
        { playerId: 2 }
    );

    const limited = fixture(
        { playerId: 3, timeOnIcePerGame5v5: 300 },
        {
            playerId: 3,
            penaltyMinutes: 200,
            penalties: 100,
            penaltiesDrawn: 100,
            netPenalties: 0
        }
    );

    const fixtures = [first, second, limited];

    const rows = buildDisciplineReference(
        fixtures.map((item) => item.shooting),
        fixtures.map((item) => item.penalty),
        SEASON
    );

    const baselines = calculateBaselines(rows, DISCIPLINE_METRICS);
    const pim = baselines.find(
        (row) => row.metric === "penaltyMinutesPerGame"
    );
    const drawn = baselines.find(
        (row) => row.metric === "penaltiesDrawnPerGame"
    );

    assert.equal(pim.eligiblePlayers, 2);
    assert.equal(pim.mean, 0.3);
    assert.equal(pim.populationStandardDeviation, 0.3);
    assert.equal(drawn.mean, 0.1);
    assert.equal(drawn.populationStandardDeviation, 0.1);
});

function scoringFixture(overrides = {}) {
    const record = {
        season: "20252026",
        playerId: "1",
        player: "Example Player",
        position: "D",
        gamesPlayed: "20",
        estimatedMinutes5v5: "300",
        penaltyMinutes: "4",
        penaltyMinutesPerGame: "0.2",
        penaltiesTaken: "2",
        penaltiesDrawn: "8",
        penaltiesDrawnPerGame: "0.4",
        netPenalties: "6",
        ...overrides
    };

    const baselines = new Map(
        [
            ["penaltyMinutesPerGame", 0.5, 0.3],
            ["penaltiesDrawnPerGame", 0.2, 0.1]
        ].map(([metric, mean, deviation]) => [
            baselineKey(record.season, record.position, metric),
            {
                mean,
                populationStandardDeviation: deviation,
                scalingStatus: "Available"
            }
        ])
    );

    return { record, baselines };
}

function disciplineScore(overrides = {}) {
    const { record, baselines } = scoringFixture(overrides);
    return calculateDisciplineSeasonScore(record, baselines);
}

function close(actual, expected) {
    assert.ok(
        Math.abs(actual - expected) < 1e-12,
        `Expected ${expected}, received ${actual}`
    );
}

test("discipline combines lower PIM credit and the 0.10 drawing bonus", () => {
    const result = disciplineScore();

    close(result.disciplineFoundation, 1);
    close(result.penaltiesDrawnStandardizedValue, 2);
    close(result.penaltiesDrawnBonus, 0.2);
    close(result.disciplineIndex, 1.2);
});

test("average or below-average drawing earns zero bonus", () => {
    for (const drawn of [0, 0.1, 0.2]) {
        const result = disciplineScore({
            penaltiesDrawnPerGame: String(drawn)
        });

        assert.equal(result.penaltiesDrawnBonus, 0);
        close(result.disciplineIndex, result.disciplineFoundation);
    }
});

test("higher PIM reduces discipline and zero PIM remains valid", () => {
    const higher = disciplineScore({
        penaltyMinutesPerGame: "0.8"
    });

    close(higher.disciplineFoundation, -1);
    close(higher.disciplineIndex, -0.8);

    const zero = disciplineScore({
        penaltyMinutesPerGame: "0"
    });

    close(zero.disciplineFoundation, 0.5 / 0.3);
});

test("discipline scoring starts at 300 minutes with no bonus-only score", () => {
    for (const minutes of [299.999, 300, 300.001]) {
        const result = disciplineScore({
            estimatedMinutes5v5: String(minutes)
        });

        if (minutes < 300) {
            assert.equal(result.sampleStatus, "Limited sample");
            assert.equal(result.disciplineFoundation, null);
            assert.equal(result.penaltiesDrawnBonus, null);
            assert.equal(result.disciplineIndex, null);
            assert.equal(result.gamesPlayed, "20");
        } else {
            assert.equal(result.sampleStatus, "Eligible");
            close(result.disciplineIndex, 1.2);
        }
    }
});

test("discipline scoring rejects invalid eligible rates and exposure", () => {
    for (const field of [
        "penaltyMinutesPerGame",
        "penaltiesDrawnPerGame",
        "estimatedMinutes5v5"
    ]) {
        for (const value of ["", " ", null, undefined, "invalid", -1]) {
            assert.throws(
                () => disciplineScore({ [field]: value }),
                /Missing number|Invalid number|Negative number/
            );
        }
    }
});

test("discipline scoring requires available positive-deviation baselines", () => {
    const { record, baselines } = scoringFixture();

    assert.throws(
        () => calculateDisciplineSeasonScore(record, new Map()),
        /Unavailable discipline baseline/
    );

    const key = baselineKey(
        record.season,
        record.position,
        "penaltyMinutesPerGame"
    );

    for (const deviation of [0, -1, "", null, "invalid"]) {
        const changed = new Map(baselines);

        changed.set(key, {
            ...baselines.get(key),
            populationStandardDeviation: deviation
        });

        assert.throws(
            () => calculateDisciplineSeasonScore(record, changed),
            /Missing number|Invalid number|Invalid discipline standard deviation/
        );
    }

    const unavailable = new Map(baselines);
    unavailable.set(key, {
        ...baselines.get(key),
        scalingStatus: "Unavailable"
    });

    assert.throws(
        () => calculateDisciplineSeasonScore(record, unavailable),
        /Unavailable discipline baseline/
    );
});

test("discipline grades share ties and keep missing scores unrated", () => {
    const rows = [0, 1, 1, 3, null].map((value, index) => ({
        playerId: String(index),
        position: "D",
        disciplineIndex: value
    }));

    const rated = addPercentileRatings(
        rows,
        (row) => row.position,
        "disciplineIndex",
        "disciplineRating"
    );

    assert.deepEqual(
        rated.map((row) => row.percentile),
        [12.5, 50, 50, 87.5, null]
    );

    assert.deepEqual(
        rated.map((row) => row.disciplineRating),
        [1.3, 5, 5, 8.8, null]
    );
});

test("discipline history averages eligible indices and components equally", () => {
    const rows = [
        {
            season: "20232024",
            playerId: "1",
            player: "Example Player",
            position: "D",
            gamesPlayed: 20,
            estimatedMinutes5v5: 300,
            disciplineFoundation: 0.8,
            penaltiesDrawnBonus: 0.2,
            disciplineIndex: 1
        },
        {
            season: "20242025",
            playerId: "1",
            player: "Example Player",
            position: "D",
            gamesPlayed: 80,
            estimatedMinutes5v5: 1200,
            disciplineFoundation: 2.6,
            penaltiesDrawnBonus: 0.4,
            disciplineIndex: 3
        },
        {
            season: "20252026",
            playerId: "1",
            player: "Example Player",
            position: "C",
            gamesPlayed: 5,
            estimatedMinutes5v5: 60,
            disciplineFoundation: null,
            penaltiesDrawnBonus: null,
            disciplineIndex: null
        }
    ];

    const [history] = buildHistoricalScores(
        rows,
        "disciplineIndex",
        ["disciplineFoundation", "penaltiesDrawnBonus"]
    );

    assert.equal(history.eligibleSeasons, 2);
    assert.equal(history.position, "C");
    close(history.disciplineIndex, 2);
    close(history.disciplineFoundation, 1.7);
    close(history.penaltiesDrawnBonus, 0.3);
    assert.equal(history.gamesPlayedInRecordedSeasons, 105);
    assert.equal(history.gamesPlayedInEligibleSeasons, 100);

    const [unrated] = buildHistoricalScores(
        [rows[2]],
        "disciplineIndex",
        ["disciplineFoundation", "penaltiesDrawnBonus"]
    );

    assert.equal(unrated.eligibleSeasons, 0);
    assert.equal(unrated.disciplineIndex, null);
});