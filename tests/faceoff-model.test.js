const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildFaceoffReference,
    buildFaceoffBaselines,
    specialTeamsStatus
} = require("../scripts/collectors/collect-faceoff-reference");

const {
    calculateFaceoffSeasonScore,
    buildFaceoffHistoricalScores
} = require("../scripts/models/calculate-faceoff-ratings");

const {
    baselineKey,
    addPercentileRatings
} = require("../scripts/models/calculate-offensive-ratings");

const SEASON = 20252026;

function fixture({
    id = 1,
    position = "C",
    zones = [100, 100, 100],
    pp = 50,
    sh = 50,
    ppSeconds = 4500,
    shSeconds = 4500,
    winRate = 0.5
} = {}) {
    const total = zones.reduce((sum, count) => sum + count, 0);

    const identity = {
        seasonId: SEASON,
        playerId: id,
        skaterFullName: `Example Player ${id}`,
        positionCode: position,
        gamesPlayed: 30
    };

    const faceoffs = { ...identity };

    function counts(attemptField, winField, lossField, attempts) {
        const wins = Math.floor(attempts * winRate);
        faceoffs[attemptField] = attempts;
        faceoffs[winField] = wins;
        faceoffs[lossField] = attempts - wins;
        return wins;
    }

    let totalWins = 0;

    for (const [index, zone] of [
        "defensiveZone",
        "offensiveZone",
        "neutralZone"
    ].entries()) {
        totalWins += counts(
            `${zone}Faceoffs`,
            `${zone}FaceoffWins`,
            `${zone}FaceoffLosses`,
            zones[index]
        );
    }

    faceoffs.totalFaceoffs = total;
    faceoffs.totalFaceoffWins = totalWins;
    faceoffs.totalFaceoffLosses = total - totalWins;

    counts("ppFaceoffs", "ppFaceoffsWon", "ppFaceoffsLost", pp);
    counts("shFaceoffs", "shFaceoffsWon", "shFaceoffsLost", sh);
    counts(
        "evFaceoffs",
        "evFaceoffsWon",
        "evFaceoffsLost",
        total - pp - sh
    );

    return {
        faceoffs,
        iceTime: {
            ...identity,
            ppTimeOnIce: ppSeconds,
            shTimeOnIce: shSeconds
        }
    };
}

function build(options = {}) {
    const { faceoffs, iceTime } = fixture(options);

    return buildFaceoffReference(
        [faceoffs],
        [iceTime],
        SEASON
    )[0];
}

test("faceoff reference preserves counts and calculates fractions", () => {
    const row = build();

    assert.equal(row.totalFaceoffs, 300);
    assert.equal(row.totalFaceoffWins, 150);
    assert.equal(row.overallFaceoffWinPct, 0.5);
    assert.equal(row.faceoffsPerGame, 10);
    assert.equal(row.powerPlayMinutes, 75);
    assert.equal(row.defensiveZoneFaceoffWinPct, 0.5);
});

test("overall and zone boundaries remain independent", () => {
    const belowOverall = build({ zones: [99, 100, 100] });
    assert.equal(belowOverall.overallSampleStatus, "Limited sample");
    assert.equal(belowOverall.combinedSampleStatus, "Limited sample");

    const exact = build();
    assert.equal(exact.overallSampleStatus, "Eligible");
    assert.equal(exact.combinedSampleStatus, "Eligible");

    const incomplete = build({ zones: [99, 100, 101] });
    assert.equal(incomplete.overallSampleStatus, "Eligible");
    assert.equal(incomplete.defensiveZoneSampleStatus, "Limited sample");
    assert.equal(incomplete.offensiveZoneSampleStatus, "Eligible");
    assert.equal(
        incomplete.combinedSampleStatus,
        "Incomplete zone sample"
    );
});

test("special teams require a regular role or draw-volume exception", () => {
    assert.equal(
        specialTeamsStatus(true, 75, 50),
        "Regular usage"
    );
    assert.equal(
        specialTeamsStatus(true, 74.999, 50),
        "Below situational minimum"
    );
    assert.equal(
        specialTeamsStatus(true, 75, 49),
        "Below situational minimum"
    );
    assert.equal(
        specialTeamsStatus(true, 10, 99),
        "Below situational minimum"
    );
    assert.equal(
        specialTeamsStatus(true, 10, 100),
        "Draw-volume exception"
    );
    assert.equal(
        specialTeamsStatus(true, 75, 100),
        "Regular usage"
    );
    assert.equal(
        specialTeamsStatus(false, 100, 200),
        "Below overall minimum"
    );

    const row = build({
        pp: 100,
        ppSeconds: 600,
        sh: 50,
        shSeconds: 4500
    });

    assert.equal(row.powerPlaySampleStatus, "Draw-volume exception");
    assert.equal(row.shortHandedSampleStatus, "Regular usage");
});

test("zero attempts are not applicable rather than zero percent", () => {
    const row = build({
        zones: [0, 0, 0],
        pp: 0,
        sh: 0,
        ppSeconds: 0,
        shSeconds: 0
    });

    assert.equal(row.overallSampleStatus, "Not applicable");
    assert.equal(row.combinedSampleStatus, "Not applicable");
    assert.equal(row.overallFaceoffWinPct, null);
    assert.equal(row.powerPlayFaceoffWinPct, null);
});

test("faceoff validation rejects bad counts, totals and identities", () => {
    const original = fixture();

    for (const value of [null, undefined, -1, 1.5, "100", NaN]) {
        assert.throws(
            () => buildFaceoffReference(
                [{ ...original.faceoffs, totalFaceoffs: value }],
                [original.iceTime],
                SEASON
            ),
            /Invalid faceoff count/
        );
    }

    const altered = {
        ...original.faceoffs,
        defensiveZoneFaceoffWins: 49,
        defensiveZoneFaceoffLosses: 50
    };

    assert.throws(
        () => buildFaceoffReference(
            [altered],
            [original.iceTime],
            SEASON
        ),
        /Faceoff wins\/losses mismatch/
    );

    assert.throws(
        () => buildFaceoffReference(
            [original.faceoffs],
            [{ ...original.iceTime, gamesPlayed: 29 }],
            SEASON
        ),
        /Faceoff identity mismatch/
    );

    assert.throws(
        () => buildFaceoffReference(
            [original.faceoffs],
            [{ ...original.iceTime, playerId: 2 }],
            SEASON
        ),
        /Faceoff report coverage differs/
    );

    assert.throws(
        () => build({ ppSeconds: -1 }),
        /Invalid special-teams ice time/
    );
});

test("faceoff baselines pool positions using each metric's eligibility", () => {
    const first = build({
        id: 1,
        position: "C",
        winRate: 0
    });

    const second = build({
        id: 2,
        position: "R",
        winRate: 1,
        zones: [100, 99, 101]
    });

    const limited = build({
        id: 3,
        zones: [99, 100, 100],
        winRate: 1
    });

    const baselines = buildFaceoffBaselines([
        first,
        second,
        limited
    ]);

    const defensive = baselines.find(
        (row) => row.metric === "defensiveZoneFaceoffWinPct"
    );
    const offensive = baselines.find(
        (row) => row.metric === "offensiveZoneFaceoffWinPct"
    );

    assert.equal(defensive.position, "All");
    assert.equal(defensive.eligiblePlayers, 2);
    assert.equal(defensive.mean, 0.5);
    assert.equal(defensive.populationStandardDeviation, 0.5);

    assert.equal(offensive.eligiblePlayers, 1);
    assert.equal(offensive.mean, 0);

    // Baseline pooling must not change player position labels.
    assert.equal(first.position, "C");
    assert.equal(second.position, "R");
});

test("recorded faceoffs can coexist with zero elapsed special-teams time", () => {
    const row = build({
        pp: 1,
        ppSeconds: 0,
        sh: 1,
        shSeconds: 0
    });

    assert.equal(row.ppFaceoffs, 1);
    assert.equal(row.powerPlayMinutes, 0);
    assert.equal(row.shFaceoffs, 1);
    assert.equal(row.shortHandedMinutes, 0);
    assert.equal(
        row.powerPlaySampleStatus,
        "Below situational minimum"
    );
    assert.equal(
        row.shortHandedSampleStatus,
        "Below situational minimum"
    );
});

const SCORING_METRICS = [
    "defensiveZoneFaceoffWinPct",
    "offensiveZoneFaceoffWinPct",
    "neutralZoneFaceoffWinPct"
];

function scoringFixture(overrides = {}) {
    const record = {
        season: "20252026",
        playerId: "1",
        player: "Example Player",
        position: "R",
        gamesPlayed: "30",
        totalFaceoffs: "300",
        defensiveZoneFaceoffs: "100",
        offensiveZoneFaceoffs: "100",
        neutralZoneFaceoffs: "100",
        defensiveZoneFaceoffWinPct: "0.60",
        offensiveZoneFaceoffWinPct: "0.45",
        neutralZoneFaceoffWinPct: "0.55",
        ...overrides
    };

    const baselines = new Map(
        SCORING_METRICS.map((metric) => [
            baselineKey(record.season, "All", metric),
            {
                mean: 0.5,
                populationStandardDeviation: 0.05,
                scalingStatus: "Available"
            }
        ])
    );

    return { record, baselines };
}

function score(overrides = {}) {
    const { record, baselines } = scoringFixture(overrides);
    return calculateFaceoffSeasonScore(record, baselines);
}

function close(actual, expected) {
    assert.ok(
        Math.abs(actual - expected) < 1e-12,
        `Expected ${expected}, received ${actual}`
    );
}

test("faceoff index uses pooled baselines and 50/30/20 weights", () => {
    const result = score();

    // Standardized zone values: 2, -1, 1.
    // Weighted contributions: 1, -0.3, 0.2.
    close(
        result.defensiveZoneFaceoffWinPctContribution,
        1
    );
    close(
        result.offensiveZoneFaceoffWinPctContribution,
        -0.3
    );
    close(
        result.neutralZoneFaceoffWinPctContribution,
        0.2
    );
    close(result.faceoffIndex, 0.9);
    assert.equal(result.position, "R");
});

test("incomplete faceoff profiles receive no partial combined score", () => {
    for (const zone of [
        "defensiveZone",
        "offensiveZone",
        "neutralZone"
    ]) {
        const result = score({
            totalFaceoffs: "301",
            defensiveZoneFaceoffs: "101",
            offensiveZoneFaceoffs: "101",
            neutralZoneFaceoffs: "101",
            [`${zone}Faceoffs`]: "99"
        });

        assert.equal(result.sampleStatus, "Incomplete zone sample");
        assert.equal(result.faceoffIndex, null);

        for (const metric of SCORING_METRICS) {
            assert.equal(result[`${metric}Contribution`], null);
        }
    }

    assert.equal(score().sampleStatus, "Eligible");

    const limited = score({
        totalFaceoffs: "299",
        defensiveZoneFaceoffs: "99"
    });

    assert.equal(limited.sampleStatus, "Limited sample");
    assert.equal(limited.faceoffIndex, null);
});

test("no faceoff participation remains not applicable and zero percent is valid", () => {
    const absent = score({
        totalFaceoffs: "0",
        defensiveZoneFaceoffs: "0",
        offensiveZoneFaceoffs: "0",
        neutralZoneFaceoffs: "0",
        defensiveZoneFaceoffWinPct: null,
        offensiveZoneFaceoffWinPct: null,
        neutralZoneFaceoffWinPct: null
    });

    assert.equal(absent.sampleStatus, "Not applicable");
    assert.equal(absent.faceoffIndex, null);

    const zero = score({
        defensiveZoneFaceoffWinPct: "0"
    });

    close(zero.defensiveZoneFaceoffWinPctContribution, -5);
    close(zero.faceoffIndex, -5.1);
});

test("faceoff scoring rejects invalid counts and eligible percentages", () => {
    for (const value of ["", null, undefined, "invalid", -1, 1.5]) {
        assert.throws(
            () => score({ totalFaceoffs: value }),
            /Missing number|Invalid number|Invalid faceoff count/
        );
    }

    for (const metric of SCORING_METRICS) {
        for (const value of ["", null, undefined, "invalid", -0.1, 1.1]) {
            assert.throws(
                () => score({ [metric]: value }),
                /Missing number|Invalid number|Invalid faceoff scoring input/
            );
        }
    }
});

test("faceoff scoring requires available pooled baselines with positive deviations", () => {
    const { record, baselines } = scoringFixture();

    assert.throws(
        () => calculateFaceoffSeasonScore(record, new Map()),
        /Unavailable faceoff baseline/
    );

    const key = baselineKey(
        record.season,
        "All",
        "defensiveZoneFaceoffWinPct"
    );

    for (const deviation of [0, -1, "", null]) {
        const changed = new Map(baselines);

        changed.set(key, {
            ...baselines.get(key),
            populationStandardDeviation: deviation
        });

        assert.throws(
            () => calculateFaceoffSeasonScore(record, changed),
            /Missing number|Invalid faceoff scoring input/
        );
    }

    const unavailable = new Map(baselines);
    unavailable.set(key, {
        ...baselines.get(key),
        scalingStatus: "Unavailable"
    });

    assert.throws(
        () => calculateFaceoffSeasonScore(record, unavailable),
        /Unavailable faceoff baseline/
    );
});

function historyRow(season, index, overrides = {}) {
    return {
        season,
        playerId: "1",
        player: "Example Player",
        position: "C",
        gamesPlayed: 30,
        totalFaceoffs: 300,
        sampleStatus: index === null
            ? "Incomplete zone sample"
            : "Eligible",
        faceoffIndex: index,
        defensiveZoneFaceoffWinPctContribution:
            index === null ? null : index * 0.5,
        offensiveZoneFaceoffWinPctContribution:
            index === null ? null : index * 0.3,
        neutralZoneFaceoffWinPctContribution:
            index === null ? null : index * 0.2,
        ...overrides
    };
}

test("faceoff history averages eligible seasons equally and retains draw exposure", () => {
    const [history] = buildFaceoffHistoricalScores([
        historyRow("20232024", 1),
        historyRow("20242025", 3, {
            gamesPlayed: 80,
            totalFaceoffs: 1200
        }),
        historyRow("20252026", null, {
            gamesPlayed: 20,
            totalFaceoffs: 200,
            position: "R"
        }),
        historyRow("20262027", 99)
    ]);

    assert.equal(history.availableSeasons, 3);
    assert.equal(history.eligibleSeasons, 2);
    assert.equal(history.includedSeasons, "20232024,20242025");
    assert.equal(history.position, "R");
    close(history.faceoffIndex, 2);
    close(history.defensiveZoneFaceoffWinPctContribution, 1);
    close(history.offensiveZoneFaceoffWinPctContribution, 0.6);
    close(history.neutralZoneFaceoffWinPctContribution, 0.4);
    assert.equal(history.faceoffsInRecordedSeasons, 1700);
    assert.equal(history.faceoffsInEligibleSeasons, 1500);
    assert.equal(history.gamesPlayedInRecordedSeasons, 130);
    assert.equal(history.gamesPlayedInEligibleSeasons, 110);
});

test("faceoff history distinguishes no participation from incomplete history", () => {
    const [absent] = buildFaceoffHistoricalScores([
        historyRow("20252026", null, {
            totalFaceoffs: 0,
            sampleStatus: "Not applicable"
        })
    ]);

    assert.equal(absent.historyStatus, "Not applicable");
    assert.equal(absent.faceoffIndex, null);
    assert.equal(absent.eligibleSeasons, 0);

    const [incomplete] = buildFaceoffHistoricalScores([
        historyRow("20252026", null)
    ]);

    assert.equal(incomplete.historyStatus, "No eligible history");
    assert.equal(incomplete.faceoffIndex, null);
});

test("faceoff grades pool positions, share ties and retain unrated players", () => {
    const rows = [0, 1, 1, 3, null].map((value, index) => ({
        playerId: String(index),
        position: index % 2 === 0 ? "C" : "R",
        faceoffIndex: value
    }));

    const rated = addPercentileRatings(
        rows,
        () => "All",
        "faceoffIndex",
        "faceoffRating"
    );

    assert.deepEqual(
        rated.map((row) => row.percentile),
        [12.5, 50, 50, 87.5, null]
    );

    assert.deepEqual(
        rated.map((row) => row.faceoffRating),
        [1.3, 5, 5, 8.8, null]
    );
});