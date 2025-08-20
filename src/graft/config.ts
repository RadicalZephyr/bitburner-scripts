import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['graftAugmentScoreTolerance', 0.0001],
    ['graftAugmentTimeTolerance', 1000],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'GRAFT',
    entries,
) as ConfigInstance<typeof entries>;
