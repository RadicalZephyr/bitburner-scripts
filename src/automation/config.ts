import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['companyRepForFaction', 400_000],
    ['moneyTrackerCadence', 10_000],
    ['moneyTrackerHistoryLen', 3],
    ['maxTimeToEarnNeuroFlux', 60 * 30],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'AUTO',
    entries,
) as ConfigInstance<typeof entries>;
