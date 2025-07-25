import { Config, ConfigInstance } from 'util/config';

const entries = [['companyRepForFaction', 400_000]] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'AUTO',
    entries,
) as ConfigInstance<typeof entries>;
