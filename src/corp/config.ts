import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['noodleEatingInterval', 20],
    ['lowEnergyThreshold', 0.99],
    ['lowMoraleThreshold', 0.99],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'CORP',
    entries,
) as ConfigInstance<typeof entries>;
