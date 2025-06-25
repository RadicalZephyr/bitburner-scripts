import { LocalStorage } from "util/localStorage";

const BATCH_INTERVAL = "BATCH_INTERVAL";

const MAX_TILL_TARGETS = "MAX_TILL_TARGETS";

class Config {
    setDefaults() {
        setConfigDefault(BATCH_INTERVAL, 250);
        setConfigDefault(MAX_TILL_TARGETS, 2);
    }

    get batchInterval() {
        return LocalStorage.getItem(BATCH_INTERVAL);
    }

    get maxTillTargets() {
        return LocalStorage.getItem(MAX_TILL_TARGETS);
    }
}

function setConfigDefault(key, defaultValue) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, defaultValue);
    }
}

export const CONFIG = new Config();
