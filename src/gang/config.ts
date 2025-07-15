import { Config, ConfigInstance } from "util/config";

const entries = [
    ["ascendThreshold", 1.01],
    ["trainingPercent", 4 / 12],
    ["maxWantedPenalty", 0.05],
    ["minWantedLevel", 10],
    ["jobCheckInterval", 5000],
    ["trainingTask", "Train Combat"],
    ["hackTrainVelocity", 1],
    ["combatTrainVelocity", 1],
    ["charismaTrainVelocity", 1],
] as const;

export const CONFIG: ConfigInstance<typeof entries> =
    new Config("GANG", entries) as ConfigInstance<typeof entries>;
