import { Config } from 'util/config';
/** Configuration settings for stock scripts persisted in LocalStorage. */
const entries = [
    ['bollingerK', 2],
    ['buyPercentile', 10],
    ['cooldownMs', 60000],
    ['dataPath', '/stocks/'],
    ['emaPeriod', 5],
    ['maxPosition', 1000],
    ['rocPeriod', 5],
    ['sellPercentile', 90],
    ['smaPeriod', 5],
    ['windowSize', 60],
];
export const CONFIG = new Config('STOCK', entries);
