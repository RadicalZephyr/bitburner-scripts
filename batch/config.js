import { Config } from "util/config";
const entries = [
    ["batchInterval", 80],
    ["maxTillTargets", 2],
    ["maxSowTargets", 2],
    ["expectedValueThreshold", 100],
    ["minSecTolerance", 1],
    ["maxMoneyTolerance", 0.99],
    ["maxHackPercent", 0.5],
    ["heartbeatCadence", 2000],
    ["heartbeatTimeoutMs", 3000],
    ["hackLevelVelocityThreshold", 0.05],
    ["harvestRetryMax", 5],
    ["harvestRetryWait", 50],
    ["launchFailLimit", 5],
    ["launchFailBackoffMs", 2000]
];
export const CONFIG = new Config("BATCH", entries);
