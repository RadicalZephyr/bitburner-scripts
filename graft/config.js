import { Config } from 'util/config';
const entries = [
    ['graftAugmentScoreTolerance', 0.0001],
    ['graftAugmentTimeTolerance', 1000],
];
export const CONFIG = new Config('GRAFT', entries);
