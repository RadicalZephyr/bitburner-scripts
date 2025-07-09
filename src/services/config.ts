import { Config, ConfigInstance } from "util/config";

const entries = [
    ["subscriptionMaxRetries", 5],
    ["launchRetryMax", 5]
] as const;

export const CONFIG: ConfigInstance<typeof entries> =
    new Config("DISCOVERY", entries) as ConfigInstance<typeof entries>;
