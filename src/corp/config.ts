import { Config, ConfigInstance } from "util/config";

const entries = [
    ["noodleEatingInterval", 20]
] as const;

export const CONFIG: ConfigInstance<typeof entries> =
    new Config("CORP", entries) as ConfigInstance<typeof entries>;
