import { Config } from 'util/config';
const entries = [
    ['noodleEatingInterval', 20],
    ['lowEnergyThreshold', 0.99],
    ['lowMoraleThreshold', 0.99],
];
export const CONFIG = new Config('CORP', entries);
