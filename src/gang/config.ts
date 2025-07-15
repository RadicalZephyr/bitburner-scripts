import { Config, ConfigInstance } from "util/config";

const entries = [
    ["ascendThreshold", 1.01],
    ["trainingPercent", 4 / 12],
    // Maximum wanted level penalty tolerated before switching to cooling tasks
    ["maxWantedPenalty", 0.05],
    ["minWantedLevel", 10],
    ["jobCheckInterval", 5000],
    ["hackTrainVelocity", 1],
    ["combatTrainVelocity", 1],
    ["charismaTrainVelocity", 1],
    ["recruitHorizon", 60],
    ["velocityThreshold", 0.1],
    ["maxROITime", {
        bootstrapping: 60,
        respectGrind: 60,
        moneyGrind: 60,
        warfare: 60,
        cooling: 60,
    }],
] as const;

export const CONFIG: ConfigInstance<typeof entries> =
    new Config("GANG", entries) as ConfigInstance<typeof entries>;
