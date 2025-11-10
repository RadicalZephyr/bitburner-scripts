import { Config } from 'util/config';
const entries = [
    ['boardSize', 9],
    ['goOpponent', 'Daedalus'],
    ['gtpProxyHost', 'localhost'],
    ['gtpProxyPort', '18924'],
    ['maxEngineInvalidMoves', 5],
    ['maxOpponentPasses', 5],
    ['playGo', true],
];
export const CONFIG = new Config('GO', entries);
