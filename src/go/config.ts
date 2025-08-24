import { GoOpponent } from 'netscript';
import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['boardSize', 9 as 5 | 7 | 9 | 13],
    ['goOpponent', 'Daedalus' as GoOpponent],
    ['gtpProxyHost', 'localhost'],
    ['gtpProxyPort', '18924'],
    ['maxEngineInvalidMoves', 5],
    ['maxOpponentPasses', 5],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'GO',
    entries,
) as ConfigInstance<typeof entries>;
