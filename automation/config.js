import { Config } from 'util/config';
const entries = [
    ['bruteSshHackRequirement', 1],
    ['ftpCrackHackRequirement', 30],
    ['combatTrainTimeMs', 10_000],
    ['companyRepForFaction', 400_000],
    ['companyWorkTimeMs', 10_000],
    ['factionWorkTimeMs', 10_000],
    ['moneyTrackerCadence', 10_000],
    ['moneyTrackerHistoryLen', 3],
    ['maxTimeToEarnNeuroFlux', 60 * 30],
];
export const CONFIG = new Config('AUTO', entries);
