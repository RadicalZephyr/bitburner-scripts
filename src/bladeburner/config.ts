import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['chaosSwitchToDiplomacy', 50],
    ['highStaminaPercent', 0.95],
    ['lowStaminaPercent', 0.56],
    ['maxChaos', 1.0],
    ['maxSuccessChanceSpread', 0.1],
    ['minBlackOpSuccess', 0.9],
    ['minHealthPercent', 0.8],
    ['minSROSuccess', 0.8],
    ['minSurveySuccess', 0.75],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'BLADE',
    entries,
) as ConfigInstance<typeof entries>;
