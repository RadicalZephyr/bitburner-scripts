import { Config, ConfigInstance } from 'util/config';

const entries = [['openHUD', true]] as const;

export const UI_CONFIG: ConfigInstance<typeof entries> = new Config(
    'BLADE',
    entries,
) as ConfigInstance<typeof entries>;
