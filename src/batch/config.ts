import { Config, ConfigInstance } from "util/config";

const entries = [
    ["batchInterval", 80],
    ["maxTillTargets", 2],
    ["maxSowTargets", 2],
    ["expectedValueThreshold", 100],
    ["minSecTolerance", 1],
    ["maxMoneyTolerance", 0.99],
    ["maxHackPercent", 0.5],
    ["heartbeatTimeoutMs", 3000],
] as const;

export const CONFIG: ConfigInstance<typeof entries> =
    new Config("BATCH", entries) as ConfigInstance<typeof entries>;
