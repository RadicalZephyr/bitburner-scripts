import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['discoverWalkIntervalMs', 5000],
    ['launchRetryMax', 5],
    ['subscriptionMaxRetries', 5],
    ['updateCheckIntervalMs', 1000 * 60 * 60],
    ['minRamDoublings', 3],
    ['maxPaybackTimeSec', 3600],
    ['baseCheckIntervalMs', 60_000],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'DISCOVERY',
    entries,
) as ConfigInstance<typeof entries>;
