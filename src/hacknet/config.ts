import { Config, ConfigInstance } from 'util/config';

const entries = [
  ['paybackTimeTolerance', 60],
  ['sellSleepTime', 60_000],
] as const;

export const CONFIG: ConfigInstance<typeof entries> = new Config(
  'HACKNET',
  entries,
) as ConfigInstance<typeof entries>;
