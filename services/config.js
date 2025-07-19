import { Config } from "util/config";
const entries = [
    ["subscriptionMaxRetries", 5],
    ["launchRetryMax", 5],
    ["updateCheckIntervalMs", 1000 * 60 * 60]
];
export const CONFIG = new Config("DISCOVERY", entries);
