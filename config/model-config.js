const HISTORICAL_SEASONS = Object.freeze([
    20232024,
    20242025,
    20252026
]);

module.exports = Object.freeze({
    modelVersion: "offense-v1-provisional",

    historicalSeasons: HISTORICAL_SEASONS,
    latestCompletedSeason:
        HISTORICAL_SEASONS[HISTORICAL_SEASONS.length - 1],

    rosterSeason: 20262027,

    minimumMinutes5v5: 300,
    minimumPowerPlayMinutes: 75,
    minimumShortHandedMinutes: 75,

    fiveOnFiveWeights: Object.freeze({
        goalsPer605v5: 0.54,
        primaryAssistsPer605v5: 0.27,
        secondaryAssistsPer605v5: 0.09,
        individualShotsForPer60: 0.10
    }),

    powerPlayCoefficient: 1,

    defensiveModelVersion: "defense-v1-provisional",

    defensiveSuppressionWeights: Object.freeze({
        teamEstimatedOnIceUnblockedAttemptsAgainstPer60_5v5: 0.70,
        teamOnIceGoalsAgainstPer60EvenStrength: 0.30
    }),

    defensiveBonusCoefficients: Object.freeze({
        individualBlockedShotsPer60AllSituations: 0.05,
        individualTakeawaysPer60AllSituations: 0.025
    })
});