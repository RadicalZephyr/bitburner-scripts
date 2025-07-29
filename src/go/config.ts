import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['gtpProxyHost', 'localhost'],
    ['gtpProxyPort', '18924'],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'GO',
    entries,
) as ConfigInstance<typeof entries>;
