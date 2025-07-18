import type { NS } from "netscript";

import { every } from "util/time";
import { CONFIG } from "services/config";

interface Version {
    date: string;
    epoch: number;
    sha: string;
}

const VERSION_FILE = "VERSION.json";
const REMOTE_URL = "https://github.com/RadicalZephyr/bitburner-scripts/raw/refs/heads/latest-files/VERSION.json";
const BOOTSTRAP_URL = "https://github.com/RadicalZephyr/bitburner-scripts/raw/refs/heads/latest-files/bootstrap.js";

export async function main(ns: NS) {
    ns.disableLog("sleep");

    const host = ns.self().server;
    const tempFile = "VERSION.remote.json";

    while (true) {
        if (!ns.fileExists(VERSION_FILE, "home")) {
            ns.print(`INFO: ${VERSION_FILE} not found on home, exiting updater`);
            return;
        }

        if (!await ns.wget(REMOTE_URL, tempFile, host)) {
            ns.print("WARN: failed to download VERSION.json");
            continue;
        }

        if (!ns.scp(VERSION_FILE, host, "home")) {
            ns.print(`WARN: failed to copy ${VERSION_FILE} from home`);
            ns.rm(tempFile, host);
            continue;
        }

        let remote: Version;
        let local: Version;
        try {
            remote = JSON.parse(ns.read(tempFile));
        } catch (err) {
            ns.print(`ERROR: failed to parse ${tempFile}: ${String(err)}`);
            ns.rm(tempFile, host);
            ns.rm(VERSION_FILE, host);
            continue;
        }

        try {
            local = JSON.parse(ns.read(VERSION_FILE));
        } catch (err) {
            ns.print(`ERROR: failed to parse ${VERSION_FILE}: ${String(err)}`);
            ns.rm(tempFile, host);
            ns.rm(VERSION_FILE, host);
            continue;
        }

        ns.rm(tempFile, host);
        ns.rm(VERSION_FILE, host);

        if (remote.epoch > local.epoch && remote.sha !== local.sha) {
            const prompt =
                `A newer version of the scripts was published on ${remote.date}. ` +
                `Download now?`;
            if (await ns.prompt(prompt)) {
                const file = "external-bootstrap.js";
                if (await ns.wget(BOOTSTRAP_URL, file, "home")) {
                    ns.exec(file, "home");
                    return;
                }
                ns.print("ERROR: failed to download bootstrap.js");
            }
        }

        await ns.sleep(CONFIG.updateCheckIntervalMs);
    }
}
