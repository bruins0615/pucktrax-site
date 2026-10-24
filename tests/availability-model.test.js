const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildParticipationRecord
} = require("../scripts/collectors/collect-availability-reference");

function fixture(overrides = {}) {
    return {
        playerId: 1,
        player: "Example Player",
        season: 20252026,
        position: "C",
        careerGamesEnteringSeason: 250,
        gamesPlayed: 75,
        coverageStatus: "Recorded appearances",
        ...overrides
    };
}

test("veteran eligibility begins at exactly 250 entering career games", () => {
    const below = buildParticipationRecord(
        fixture({ careerGamesEnteringSeason: 249 })
    );
    const eligible = buildParticipationRecord(fixture());

    assert.equal(below.participationStatus, "Below veteran minimum");
    assert.equal(below.gamesPlayed, 75);
    assert.equal(eligible.participationStatus, "Eligible");
});

test("verified zero requires evidence and remains an eligible season", () => {
    const record = buildParticipationRecord(fixture({
        gamesPlayed: 0,
        coverageStatus: "Verified zero",
        verificationSource: "Example verification source"
    }));

    assert.equal(record.gamesPlayed, 0);
    assert.equal(record.participationStatus, "Eligible");

    assert.throws(() => buildParticipationRecord(fixture({
        gamesPlayed: 0,
        coverageStatus: "Verified zero"
    })), /requires zero games and a source/);

    assert.throws(() => buildParticipationRecord(fixture({
        gamesPlayed: 5,
        coverageStatus: "Verified zero",
        verificationSource: "Example verification source"
    })), /requires zero games and a source/);
});

test("unresolved coverage remains null rather than zero", () => {
    const record = buildParticipationRecord(fixture({
        gamesPlayed: null,
        coverageStatus: "Unresolved"
    }));

    assert.equal(record.gamesPlayed, null);
    assert.equal(record.participationStatus, "Unresolved");

    assert.throws(() => buildParticipationRecord(fixture({
        gamesPlayed: 0,
        coverageStatus: "Unresolved"
    })), /must remain null/);
});

test("recorded appearances cannot silently establish a zero season", () => {
    assert.throws(
        () => buildParticipationRecord(
            fixture({ gamesPlayed: 0 })
        ),
        /Zero games require verification/
    );
});

test("actual appearances above 82 are preserved", () => {
    const record = buildParticipationRecord(
        fixture({ gamesPlayed: 84 })
    );

    assert.equal(record.gamesPlayed, 84);
});

test("invalid career games, appearances and coverage are rejected", () => {
    for (const value of [null, -1, 250.5, NaN, Infinity]) {
        assert.throws(() => buildParticipationRecord(fixture({
            careerGamesEnteringSeason: value
        })), /Invalid entering career games/);
    }

    for (const value of [null, -1, 20.5, NaN, Infinity]) {
        assert.throws(() => buildParticipationRecord(fixture({
            gamesPlayed: value
        })), /Invalid games played/);
    }

    assert.throws(() => buildParticipationRecord(fixture({
        coverageStatus: "Unknown"
    })), /Invalid coverage status/);
});

test("outside NHL involvement is excluded rather than assigned zero", () => {
    const record = buildParticipationRecord(fixture({
        gamesPlayed: null,
        coverageStatus: "Outside NHL involvement",
        verificationSource: "Example retirement source"
    }));

    assert.equal(record.gamesPlayed, null);
    assert.equal(record.participationStatus, "Not applicable");

    assert.throws(
        () => buildParticipationRecord(fixture({
            gamesPlayed: 0,
            coverageStatus: "Outside NHL involvement",
            verificationSource: "Example retirement source"
        })),
        /must remain null/
    );

    assert.throws(
        () => buildParticipationRecord(fixture({
            gamesPlayed: null,
            coverageStatus: "Outside NHL involvement"
        })),
        /requires a source/
    );
});

const {
    calculateAvailabilitySeasonGrade
} = require("../scripts/models/calculate-availability-ratings");

test("82 appearances earn full credit and additional games do not exceed 10", () => {
    for (const gamesPlayed of [82, 83, 84]) {
        const record = buildParticipationRecord(
            fixture({ gamesPlayed })
        );

        assert.equal(calculateAvailabilitySeasonGrade(record), 10);
    }
});

test("participation grades decline proportionally without early rounding", () => {
    const record = buildParticipationRecord(
        fixture({ gamesPlayed: 75 })
    );

    assert.equal(
        calculateAvailabilitySeasonGrade(record),
        75 / 82 * 10
    );
});

test("verified zero receives zero while unresolved and excluded remain ungraded", () => {
    const cases = [
        {
            gamesPlayed: 0,
            coverageStatus: "Verified zero",
            expected: 0
        },
        {
            gamesPlayed: null,
            coverageStatus: "Unresolved",
            expected: null
        },
        {
            gamesPlayed: null,
            coverageStatus: "Outside NHL involvement",
            expected: null
        }
    ];

    for (const { expected, ...overrides } of cases) {
        const record = buildParticipationRecord(fixture({
            ...overrides,
            verificationSource: "Example verification source"
        }));

        assert.equal(
            calculateAvailabilitySeasonGrade(record),
            expected
        );
    }
});

test("players below the entering-season veteran minimum remain ungraded", () => {
    const record = buildParticipationRecord(fixture({
        careerGamesEnteringSeason: 249,
        gamesPlayed: 82
    }));

    assert.equal(calculateAvailabilitySeasonGrade(record), null);
});

test("scoring rejects contradictory eligibility and invalid appearances", () => {
    const record = buildParticipationRecord(fixture());

    assert.throws(
        () => calculateAvailabilitySeasonGrade({
            ...record,
            careerGamesEnteringSeason: 249
        }),
        /conflicts with eligibility/
    );

    assert.throws(
        () => calculateAvailabilitySeasonGrade({
            ...record,
            gamesPlayed: null
        }),
        /Invalid games played/
    );

    assert.throws(
        () => calculateAvailabilitySeasonGrade({
            ...record,
            gamesPlayed: 5,
            coverageStatus: "Verified zero"
        }),
        /conflicts with coverage status/
    );
});

const {
    buildAvailabilityHistoricalScores
} = require("../scripts/models/calculate-availability-ratings");

test("availability history averages unrounded season grades equally", () => {
    const records = [
        buildParticipationRecord(fixture({
            season: 20232024,
            gamesPlayed: 82
        })),
        buildParticipationRecord(fixture({
            season: 20242025,
            gamesPlayed: 41
        })),
        buildParticipationRecord(fixture({
            season: 20252026,
            gamesPlayed: 75
        }))
    ];

    const [history] = buildAvailabilityHistoricalScores(records);

    assert.equal(history.eligibleSeasons, 3);
    assert.equal(
        history.availabilityRating,
        (75 / 82 * 10 + 5 + 10) / 3
    );
    assert.equal(history.historyStatus, "Available");
});

test("history includes verified zero and excludes retired seasons", () => {
    const records = [
        buildParticipationRecord(fixture({
            season: 20232024,
            gamesPlayed: 82
        })),
        buildParticipationRecord(fixture({
            season: 20242025,
            gamesPlayed: 0,
            coverageStatus: "Verified zero",
            verificationSource: "Example verified absence"
        })),
        buildParticipationRecord(fixture({
            season: 20252026,
            gamesPlayed: null,
            coverageStatus: "Outside NHL involvement",
            verificationSource: "Example retirement source"
        }))
    ];

    const [history] = buildAvailabilityHistoricalScores(records);

    assert.equal(history.availabilityRating, 5);
    assert.equal(history.eligibleSeasons, 2);
    assert.equal(history.excludedSeasons, 1);
    assert.equal(history.includedSeasons, "20242025,20232024");
});

test("unresolved veteran seasons flag incomplete historical coverage", () => {
    const records = [
        buildParticipationRecord(fixture({
            season: 20242025,
            gamesPlayed: 82
        })),
        buildParticipationRecord(fixture({
            season: 20252026,
            gamesPlayed: null,
            coverageStatus: "Unresolved"
        }))
    ];

    const [history] = buildAvailabilityHistoricalScores(records);

    assert.equal(history.availabilityRating, 10);
    assert.equal(history.eligibleSeasons, 1);
    assert.equal(history.unresolvedSeasons, 1);
    assert.equal(history.historyStatus, "Incomplete coverage");
});

test("history without eligible seasons remains ungraded", () => {
    const [history] = buildAvailabilityHistoricalScores([
        buildParticipationRecord(fixture({
            careerGamesEnteringSeason: 249,
            gamesPlayed: 82
        }))
    ]);

    assert.equal(history.availabilityRating, null);
    assert.equal(history.eligibleSeasons, 0);
    assert.equal(history.historyStatus, "No eligible seasons");
});

test("history uses only the configured window and rejects duplicates", () => {
    const current = buildParticipationRecord(fixture());
    const older = buildParticipationRecord(fixture({
        season: 20222023,
        gamesPlayed: 41
    }));

    const [history] = buildAvailabilityHistoricalScores([
        older,
        current
    ]);

    assert.equal(history.eligibleSeasons, 1);
    assert.equal(history.includedSeasons, "20252026");

    assert.throws(
        () => buildAvailabilityHistoricalScores([current, current]),
        /Duplicate participation record/
    );
});