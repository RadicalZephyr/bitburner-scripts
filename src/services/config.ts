import { Config, ConfigInstance } from "util/config";

const entries = [
    ["discoverWalkIntervalMs", 5000],
    ["subscriptionMaxRetries", 5],
    ["launchRetryMax", 5],
    ["updateCheckIntervalMs", 1000 * 60 * 60]
] as const;

export const CONFIG: ConfigInstance<typeof entries> =
    new Config("DISCOVERY", entries) as ConfigInstance<typeof entries>;
