import { LocalStorage } from "util/localStorage";

const WINDOW_SIZE = "STOCK_WINDOW_SIZE";
const DATA_PATH = "STOCK_DATA_PATH";
const MAX_POSITION = "STOCK_MAX_POSITION";
const BUY_PERCENTILE = "STOCK_BUY_PCT";
const SELL_PERCENTILE = "STOCK_SELL_PCT";
const COOLDOWN_MS = "STOCK_COOLDOWN_MS";

/** Configuration settings for stock scripts persisted in LocalStorage. */
class Config {
    /** Initialize LocalStorage entries with default values. */
    setDefaults() {
        setConfigDefault(WINDOW_SIZE, (60).toString());
        setConfigDefault(DATA_PATH, "/stocks/");
        setConfigDefault(MAX_POSITION, (1000).toString());
        setConfigDefault(BUY_PERCENTILE, (10).toString());
        setConfigDefault(SELL_PERCENTILE, (90).toString());
        setConfigDefault(COOLDOWN_MS, (60000).toString());
    }

    get windowSize() {
        return Number(LocalStorage.getItem(WINDOW_SIZE));
    }

    get dataPath() {
        return LocalStorage.getItem(DATA_PATH);
    }

    get maxPosition() {
        return Number(LocalStorage.getItem(MAX_POSITION));
    }

    get buyPercentile() {
        return Number(LocalStorage.getItem(BUY_PERCENTILE));
    }

    get sellPercentile() {
        return Number(LocalStorage.getItem(SELL_PERCENTILE));
    }

    get cooldownMs() {
        return Number(LocalStorage.getItem(COOLDOWN_MS));
    }
}

function setConfigDefault(key: string, value: string) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, value);
    }
}

/** Singleton configuration for the stock tracker. */
export const CONFIG = new Config();
