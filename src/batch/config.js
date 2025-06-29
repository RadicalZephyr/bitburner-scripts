import { LocalStorage } from "util/localStorage";

const BATCH_INTERVAL = "BATCH_INTERVAL";

const MAX_TILL_TARGETS = "MAX_TILL_TARGETS";

const EXPECTED_VALUE_THRESHOLD = "EXPECTED_VALUE_THRESHOLD";

class Config {
    setDefaults() {
        setConfigDefault(BATCH_INTERVAL, 250);
        setConfigDefault(MAX_TILL_TARGETS, 2);
        setConfigDefault(EXPECTED_VALUE_THRESHOLD, 100);
    }

    get batchInterval() {
        return Number(LocalStorage.getItem(BATCH_INTERVAL));
    }

    get maxTillTargets() {
        return Number(LocalStorage.getItem(MAX_TILL_TARGETS));
    }

    get expectedValueThreshold() {
        return Number(LocalStorage.getItem(EXPECTED_VALUE_THRESHOLD))
    }
}

function setConfigDefault(key, defaultValue) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, defaultValue);
    }
}

export const CONFIG = new Config();
