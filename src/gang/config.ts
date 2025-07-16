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
        bootstrapping: 3600,
        respectGrind: 3600,
        moneyGrind: 3600,
        warfare: 3600,
        cooling: 3600,
    }],
] as const;

export const CONFIG: ConfigInstance<typeof entries> =
    new Config("GANG", entries) as ConfigInstance<typeof entries>;
