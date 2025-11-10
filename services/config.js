import { Config } from 'util/config';
const entries = [
    ['discoverWalkIntervalMs', 5000],
    ['garbageCollectionRateMs', 1000],
    ['maxNsFnRam', 20],
    ['memoryGrowCheckRateMs', 1000],
    ['memResponseTimeoutMs', 5000],
    ['launchRetryMax', 5],
    ['subscriptionMaxRetries', 5],
    ['updateCheckIntervalMs', 1000 * 60 * 60],
];
export const CONFIG = new Config('SERVICE', entries);
