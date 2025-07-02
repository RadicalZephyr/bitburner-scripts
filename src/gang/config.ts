import { LocalStorage } from "util/localStorage";

const ASCEND_THRESHOLD = "GANG_ASCEND_THRESHOLD";
const TRAINING_PERCENT = "GANG_TRAINING_PERCENT";
const MAX_PENALTY = "GANG_MAX_WANTED_PENALTY";
const MIN_WANTED_LEVEL = "GANG_MIN_WANTED_LEVEL";
const JOB_CHECK_INTERVAL = "GANG_JOB_CHECK_INTERVAL";

/** Configuration settings for gang management. */
class Config {
    /** Initialize LocalStorage entries with default values. */
    setDefaults() {
        setDefault(ASCEND_THRESHOLD, (1.01).toString());
        setDefault(TRAINING_PERCENT, ((4 / 12)).toString());
        setDefault(MAX_PENALTY, (0.05).toString());
        setDefault(MIN_WANTED_LEVEL, (10.0).toString());
        setDefault(JOB_CHECK_INTERVAL, (5000).toString());
    }

    get ascendThreshold() { return Number(LocalStorage.getItem(ASCEND_THRESHOLD)); }
    get trainingPercent() { return Number(LocalStorage.getItem(TRAINING_PERCENT)); }
    get maxPenalty() { return Number(LocalStorage.getItem(MAX_PENALTY)); }
    get minWantedLevel() { return Number(LocalStorage.getItem(MIN_WANTED_LEVEL)); }
    get jobCheckInterval() { return Number(LocalStorage.getItem(JOB_CHECK_INTERVAL)); }
}

function setDefault(key: string, value: string) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, value);
    }
}

/** Singleton configuration for gang management scripts. */
export const CONFIG = new Config();
