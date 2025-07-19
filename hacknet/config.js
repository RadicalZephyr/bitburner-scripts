import { Config } from "util/config";
const entries = [
    ["paybackTimeTolerance", 60],
    ["sellSleepTime", 60_000]
];
export const CONFIG = new Config("HACKNET", entries);
