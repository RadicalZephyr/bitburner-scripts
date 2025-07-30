import { GoOpponent } from 'netscript';
import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['goOpponent', 'Daedalus' as GoOpponent],
    ['boardSize', 9 as 5 | 7 | 9 | 13],
    ['gtpProxyHost', 'localhost'],
    ['gtpProxyPort', '18924'],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'GO',
    entries,
) as ConfigInstance<typeof entries>;
