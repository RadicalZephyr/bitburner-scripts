import { LocalStorage } from "util/localStorage";

const WINDOW_SIZE = "STOCK_WINDOW_SIZE";
const DATA_PATH = "STOCK_DATA_PATH";
const MAX_POSITION = "STOCK_MAX_POSITION";
const BUY_PERCENTILE = "STOCK_BUY_PCT";
const SELL_PERCENTILE = "STOCK_SELL_PCT";
const COOLDOWN_MS = "STOCK_COOLDOWN_MS";
const SMA_PERIOD = "STOCK_SMA_PERIOD";
const EMA_PERIOD = "STOCK_EMA_PERIOD";
const ROC_PERIOD = "STOCK_ROC_PERIOD";
const BOLLINGER_K = "STOCK_BOLLINGER_K";

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
        setConfigDefault(SMA_PERIOD, (5).toString());
        setConfigDefault(EMA_PERIOD, (5).toString());
        setConfigDefault(ROC_PERIOD, (5).toString());
        setConfigDefault(BOLLINGER_K, (2).toString());
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

    get smaPeriod() {
        return Number(LocalStorage.getItem(SMA_PERIOD));
    }

    get emaPeriod() {
        return Number(LocalStorage.getItem(EMA_PERIOD));
    }

    get rocPeriod() {
        return Number(LocalStorage.getItem(ROC_PERIOD));
    }

    get bollingerK() {
        return Number(LocalStorage.getItem(BOLLINGER_K));
    }
}

function setConfigDefault(key: string, value: string) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, value);
    }
}

/** Singleton configuration for the stock tracker. */
export const CONFIG = new Config();
