const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildPhysicalityReference,
    PHYSICALITY_METRICS
} = require("../scripts/collectors/collect-physicality-reference");

const {
    calculateBaselines
} = require("../scripts/collectors/collect-league-reference");

const {
    calculatePhysicalitySeasonBonus
} = require("../scripts/models/calculate-physicality-bonuses");

const {
    baselineKey
} = require("../scripts/models/calculate-offensive-ratings");

const SEASON = 20252026;

function fixture({
    id = 1,
    position = "D",
    seconds5v5PerGame = 900,
    secondsAll = 24000,
    hits = 40
} = {}) {
    const identity = {
        playerId: id,
        seasonId: SEASON,
        skaterFullName: `Example Player ${id}`,
        positionCode: position,
        gamesPlayed: 20
    };

    return {
        shooting: {
            ...identity,
            timeOnIcePerGame5v5: seconds5v5PerGame
        },
        realtime: { ...identity, hits },
        iceTime: { ...identity, timeOnIce: secondsAll }
    };
}

function build(options = {}) {
    const data = fixture(options);

    return buildPhysicalityReference(
        [data.shooting],
        [data.realtime],
        [data.iceTime],
        SEASON
    )[0];
}

test("physicality rates use games and matching all-situations ice time", () => {
    const row = build();

    assert.equal(row.estimatedMinutes5v5, 300);
    assert.equal(row.allSituationsMinutes, 400);
    assert.equal(row.hits, 40);
    assert.equal(row.hitsPerGame, 2);
    assert.equal(row.hitsPer60AllSituations, 6);
});

test("physicality eligibility includes exactly 300 five-on-five minutes", () => {
    for (const [seconds, status] of [
        [899.9, "Limited sample"],
        [900, "Eligible"],
        [900.1, "Eligible"]
    ]) {
        assert.equal(
            build({ seconds5v5PerGame: seconds }).sampleStatus,
            status
        );
    }
});

test("physicality preserves recorded zero and below-cutoff missing counts", () => {
    const zero = build({ hits: 0 });
    assert.equal(zero.hitsPerGame, 0);
    assert.equal(zero.hitsPer60AllSituations, 0);

    const missing = build({
        seconds5v5PerGame: 300,
        hits: null
    });

    assert.equal(missing.sampleStatus, "Limited sample");
    assert.equal(missing.hits, null);
    assert.equal(missing.hitsPerGame, null);
    assert.equal(missing.hitsPer60AllSituations, null);

    assert.throws(
        () => build({ hits: null }),
        /Missing eligible hit count/
    );
});

test("physicality rejects invalid hits and ice time", () => {
    for (const hits of [-1, 1.5, "40", NaN, Infinity]) {
        assert.throws(
            () => build({ hits }),
            /Invalid hit count/
        );
    }

    for (const value of [-1, null, "900", NaN, Infinity]) {
        assert.throws(
            () => build({ seconds5v5PerGame: value }),
            /Invalid physicality ice time/
        );
        assert.throws(
            () => build({ secondsAll: value }),
            /Invalid physicality ice time/
        );
    }

    assert.throws(
        () => build({ secondsAll: 0 }),
        /Hits or eligibility without ice time/
    );
});

test("physicality rejects mismatched report identities and coverage", () => {
    const data = fixture();

    assert.throws(
        () => buildPhysicalityReference(
            [data.shooting],
            [{ ...data.realtime, gamesPlayed: 19 }],
            [data.iceTime],
            SEASON
        ),
        /Physicality identity mismatch/
    );

    assert.throws(
        () => buildPhysicalityReference(
            [data.shooting],
            [data.realtime],
            [{ ...data.iceTime, positionCode: "C" }],
            SEASON
        ),
        /Physicality identity mismatch/
    );

    assert.throws(
        () => buildPhysicalityReference(
            [data.shooting],
            [{ ...data.realtime, playerId: 2 }],
            [data.iceTime],
            SEASON
        ),
        /Physicality report coverage differs/
    );
});

test("physicality baselines use eligible players and hits per game only", () => {
    const fixtures = [
        fixture({ id: 1, hits: 0 }),
        fixture({ id: 2, hits: 40 }),
        fixture({
            id: 3,
            hits: 1000,
            seconds5v5PerGame: 300
        })
    ];

    const rows = buildPhysicalityReference(
        fixtures.map((data) => data.shooting),
        fixtures.map((data) => data.realtime),
        fixtures.map((data) => data.iceTime),
        SEASON
    );

    const baselines = calculateBaselines(rows, PHYSICALITY_METRICS);

    assert.equal(baselines.length, 1);
    assert.equal(baselines[0].metric, "hitsPerGame");
    assert.equal(baselines[0].eligiblePlayers, 2);
    assert.equal(baselines[0].mean, 1);
    assert.equal(baselines[0].populationStandardDeviation, 1);
});

function scoringFixture(overrides = {}) {
    const record = {
        season: "20252026",
        playerId: "1",
        player: "Example Player",
        position: "D",
        gamesPlayed: "20",
        estimatedMinutes5v5: "300",
        allSituationsMinutes: "400",
        hits: "40",
        hitsPerGame: "2",
        hitsPer60AllSituations: "6",
        ...overrides
    };

    const baselines = new Map([
        [
            baselineKey(record.season, record.position, "hitsPerGame"),
            {
                mean: 1,
                populationStandardDeviation: 0.5,
                scalingStatus: "Available"
            }
        ]
    ]);

    return { record, baselines };
}

function bonus(overrides = {}) {
    const { record, baselines } = scoringFixture(overrides);
    return calculatePhysicalitySeasonBonus(record, baselines);
}

function close(actual, expected) {
    assert.ok(
        Math.abs(actual - expected) < 1e-12,
        `Expected ${expected}, received ${actual}`
    );
}

test("physicality applies the 0.025 positive-only coefficient", () => {
    const result = bonus();

    close(result.standardizedHitsPerGame, 2);
    close(result.uncappedPhysicalityBonus, 0.05);
    close(result.physicalityBonus, 0.05);
    assert.equal(result.capApplied, false);
});

test("physicality earns zero at or below the positional average", () => {
    for (const rate of ["0", "0.5", "1"]) {
        const result = bonus({ hitsPerGame: rate });

        assert.equal(result.uncappedPhysicalityBonus, 0);
        assert.equal(result.physicalityBonus, 0);
        assert.equal(result.capApplied, false);
    }
});

test("physicality caps credit at 0.25 while preserving uncapped values", () => {
    const boundary = bonus({ hitsPerGame: "6" });

    close(boundary.standardizedHitsPerGame, 10);
    close(boundary.uncappedPhysicalityBonus, 0.25);
    close(boundary.physicalityBonus, 0.25);
    assert.equal(boundary.capApplied, false);

    const above = bonus({ hitsPerGame: "9" });

    close(above.uncappedPhysicalityBonus, 0.4);
    close(above.physicalityBonus, 0.25);
    assert.equal(above.capApplied, true);
});

test("physicality bonuses require at least 300 five-on-five minutes", () => {
    for (const minutes of [299.999, 300, 300.001]) {
        const result = bonus({
            estimatedMinutes5v5: String(minutes)
        });

        if (minutes < 300) {
            assert.equal(result.sampleStatus, "Limited sample");
            assert.equal(result.physicalityBonus, null);
            assert.equal(result.uncappedPhysicalityBonus, null);
            assert.equal(result.capApplied, null);
            assert.equal(result.hits, "40");
        } else {
            assert.equal(result.sampleStatus, "Eligible");
            close(result.physicalityBonus, 0.05);
        }
    }
});

test("physicality scoring rejects invalid eligible rates and exposure", () => {
    for (const field of ["hitsPerGame", "estimatedMinutes5v5"]) {
        for (const value of ["", " ", null, undefined, "invalid", -1]) {
            assert.throws(
                () => bonus({ [field]: value }),
                /Missing number|Invalid number|Negative number/
            );
        }
    }
});

test("physicality scoring requires available positive-deviation baselines", () => {
    const { record, baselines } = scoringFixture();

    assert.throws(
        () => calculatePhysicalitySeasonBonus(record, new Map()),
        /Unavailable physicality baseline/
    );

    const key = baselineKey(
        record.season,
        record.position,
        "hitsPerGame"
    );

    for (const deviation of [0, -1, "", null, "invalid"]) {
        const changed = new Map(baselines);

        changed.set(key, {
            ...baselines.get(key),
            populationStandardDeviation: deviation
        });

        assert.throws(
            () => calculatePhysicalitySeasonBonus(record, changed),
            /Missing number|Invalid number|Invalid physicality standard deviation/
        );
    }

    const unavailable = new Map(baselines);
    unavailable.set(key, {
        ...baselines.get(key),
        scalingStatus: "Unavailable"
    });

    assert.throws(
        () => calculatePhysicalitySeasonBonus(record, unavailable),
        /Unavailable physicality baseline/
    );
});