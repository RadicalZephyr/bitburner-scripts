import { Config } from 'util/config';
const entries = [
    ['actionBufferMs', 200],
    ['dangerousActionPenalty', 0.1],
    ['diplomacyPowerForChaos', 0.1],
    ['highStaminaPercent', 0.95],
    ['includeDangerousActions', false],
    ['lowStaminaPercent', 0.56],
    ['maxChaos', 1.0],
    ['maxChaosGenMs', 10 * 60 * 1000],
    ['maxSuccessChanceSpread', 0.1],
    ['minBlackOpSuccess', 0.9],
    ['minSuccessSpread', 0.001],
    ['minHealthPercent', 0.8],
    ['minSurveySuccess', 0.75],
    ['skillBuyRateMs', 1000],
    ['skillBuySpendPercent', 0.01],
    ['skillPreset', ''],
];
export const CONFIG = new Config('BLADE', entries);
