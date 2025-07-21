import { Config, ConfigInstance } from 'util/config';

const entries = [
    ['batchInterval', 80],
    ['expectedValueThreshold', 100],
    ['hackLevelVelocityThreshold', 0.05],
    ['harvestRetryMax', 5],
    ['harvestRetryWait', 50],
    ['heartbeatCadence', 2000],
    ['heartbeatTimeoutMs', 3000],
    ['launchFailBackoffMs', 2000],
    ['launchFailLimit', 5],
    ['maxHackPercent', 0.5],
    ['maxMoneyTolerance', 0.99],
    ['maxSowTargets', 2],
    ['maxTillTargets', 2],
    ['minSecTolerance', 1],
    ['spawnBatchOpenTailOnExecFail', true],
    ['taskSelectorTickMs', 500],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
    'BATCH',
    entries,
) as ConfigInstance<typeof entries>;
