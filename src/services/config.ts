import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['discoverWalkIntervalMs', 5000],
    ['garbageCollectionRateMs', 1000],
    ['maxDispatchQueueSize', 200],
    ['maxNsFnRam', 20],
    ['memoryGrowCheckRateMs', 1000],
    ['memResponseTimeoutMs', 5000],
    ['launchRetryMax', 5],
    ['subscriptionMaxRetries', 5],
    ['updateCheckIntervalMs', 1000 * 60 * 60],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'SERVICE',
    entries,
) as ConfigInstance<typeof entries>;
