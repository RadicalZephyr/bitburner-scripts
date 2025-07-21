import { Config, ConfigInstance } from 'util/config';

const entries = [
  ['ascendThreshold', 1.01],
  ['charismaTrainVelocity', 1],
  ['combatTrainVelocity', 1],
  ['hackTrainVelocity', 1],
  ['jobCheckInterval', 5000],
  [
    'maxROITime',
    {
      bootstrapping: 600,
      respectGrind: 600,
      moneyGrind: 600,
      warfare: 600,
      cooling: 600,
    },
  ],
  ['maxWantedPenalty', 0.05], // Maximum wanted level penalty tolerated before switching to cooling tasks
  ['minWantedLevel', 10],
  ['recruitHorizon', 60],
  ['trainingPercent', 4 / 12],
  ['velocityThreshold', 0.1],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
  'GANG',
  entries,
) as ConfigInstance<typeof entries>;
