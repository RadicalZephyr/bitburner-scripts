import { LocalStorage } from "util/localStorage";

const WINDOW_SIZE = "STOCK_WINDOW_SIZE";
const DATA_PATH = "STOCK_DATA_PATH";
const MAX_POSITION = "STOCK_MAX_POSITION";

/** Configuration settings for stock scripts persisted in LocalStorage. */
class Config {
    /** Initialize LocalStorage entries with default values. */
    setDefaults() {
        setConfigDefault(WINDOW_SIZE, (60).toString());
        setConfigDefault(DATA_PATH, "/stocks/");
        setConfigDefault(MAX_POSITION, (1000).toString());
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
}

function setConfigDefault(key: string, value: string) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, value);
    }
}

/** Singleton configuration for the stock tracker. */
export const CONFIG = new Config();
