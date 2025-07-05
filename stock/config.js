import { Config } from "util/config";
/** Configuration settings for stock scripts persisted in LocalStorage. */
const entries = [
    ["windowSize", 60],
    ["dataPath", "/stocks/"],
    ["maxPosition", 1000],
    ["buyPercentile", 10],
    ["sellPercentile", 90],
    ["cooldownMs", 60000],
    ["smaPeriod", 5],
    ["emaPeriod", 5],
    ["rocPeriod", 5],
    ["bollingerK", 2],
];
export const CONFIG = new Config("STOCK", entries);
