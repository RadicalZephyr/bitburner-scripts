import { Config, ConfigInstance } from "util/config";

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
] as const;

export const CONFIG: ConfigInstance<typeof entries> =
    new Config("STOCK", entries) as ConfigInstance<typeof entries>;
