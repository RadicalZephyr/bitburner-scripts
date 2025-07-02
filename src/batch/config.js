import { LocalStorage } from "util/localStorage";

const BATCH_INTERVAL = "BATCH_INTERVAL";

const MAX_TILL_TARGETS = "MAX_TILL_TARGETS";

const EXPECTED_VALUE_THRESHOLD = "EXPECTED_VALUE_THRESHOLD";

const MIN_SECURITY_TOLERANCE = "MIN_SECURITY_TOLERANCE";

const MAX_MONEY_TOLERANCE = "MAX_MONEY_TOLERANCE";

const MAX_HACK_PERCENT = "MAX_HACK_PERCENT";

class Config {
    setDefaults() {
        setConfigDefault(BATCH_INTERVAL, 250);
        setConfigDefault(MAX_TILL_TARGETS, 2);
        setConfigDefault(EXPECTED_VALUE_THRESHOLD, 100);
        setConfigDefault(MIN_SECURITY_TOLERANCE, 1);
        setConfigDefault(MAX_MONEY_TOLERANCE, 0.99);
        setConfigDefault(MAX_HACK_PERCENT, 0.5);
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

    get minSecTolerance() {
        return Number(LocalStorage.getItem(MIN_SECURITY_TOLERANCE));
    }

    get maxMoneyTolerance() {
        return Number(LocalStorage.getItem(MAX_MONEY_TOLERANCE));
    }

    get maxHackPercent() {
        return Number(LocalStorage.getItem(MAX_HACK_PERCENT));
    }
}

function setConfigDefault(key, defaultValue) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, defaultValue);
    }
}

export const CONFIG = new Config();
