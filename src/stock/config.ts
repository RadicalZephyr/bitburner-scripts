import { LocalStorage } from "util/localStorage";

const WINDOW_SIZE = "STOCK_WINDOW_SIZE";
const DATA_PATH = "STOCK_DATA_PATH";

class Config {
    setDefaults() {
        setConfigDefault(WINDOW_SIZE, (60).toString());
        setConfigDefault(DATA_PATH, "/stocks/");
    }

    get windowSize() {
        return Number(LocalStorage.getItem(WINDOW_SIZE));
    }

    get dataPath() {
        return LocalStorage.getItem(DATA_PATH);
    }
}

function setConfigDefault(key: string, value: string) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, value);
    }
}

/** Singleton configuration for the stock tracker. */
export const CONFIG = new Config();
