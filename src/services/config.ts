import { LocalStorage, setConfigDefault } from "util/localStorage";

const SUB_MAX_RETRIES = "DISCOVERY_SUB_MAX_RETRIES";

class Config {
    setDefaults() {
        setConfigDefault(DISCOVERY_SUB_MAX_RETRIES, (5).toString());
    }

    get subscriptionMaxRetries() {
        return Number(LocalStorage.getItem(SUB_MAX_RETRIES));
    }
}

export const CONFIG = new Config();
