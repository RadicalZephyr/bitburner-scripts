import { Config, ConfigInstance } from 'util/config';

const entries = [['avgVelocityWindow', 5]] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'SLEEVE',
    entries,
) as ConfigInstance<typeof entries>;
