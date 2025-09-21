import type { NS } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { MemoryClient } from 'services/client/memory';

import { CONFIG } from 'services/config';
import { isNumber, isObjectLike, isString, Validator } from 'util/validate';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

interface Version {
    date: string;
    epoch: number;
    sha: string;
}

const isVersion: Validator<Version> = isObjectLike({
    date: isString,
    epoch: isNumber,
    sha: isString,
});

const VERSION_FILE = 'VERSION.json';
const REMOTE_URL =
    'https://github.com/RadicalZephyr/bitburner-scripts/raw/refs/heads/latest-files/VERSION.json';
const BOOTSTRAP_URL =
    'https://github.com/RadicalZephyr/bitburner-scripts/raw/refs/heads/latest-files/bootstrap.js';

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Automatically downloads new versions of the scripts when published.

OPTIONS
  --help   Show this help message

CONFIGURATION
  DISCOVERY_updateCheckIntervalMs  Delay between version checks
`);
        return;
    }

    ns.disableLog('sleep');

    const scriptInfo = ns.self();
    const host = scriptInfo.server;

    const tempFile = 'VERSION.remote.json';

    const memClient = new MemoryClient(ns);
    void memClient.registerAllocation(
        scriptInfo.server,
        scriptInfo.ramUsage,
        1,
    );

    while (true) {
        if (!ns.fileExists(VERSION_FILE, 'home')) {
            ns.print(
                `INFO: ${VERSION_FILE} not found on home, exiting updater`,
            );
            return;
        }

        if (!(await ns.wget(REMOTE_URL, tempFile, host))) {
            ns.print('WARN: failed to download VERSION.json');
            continue;
        }

        if (!ns.scp(VERSION_FILE, host, 'home')) {
            ns.print(`WARN: failed to copy ${VERSION_FILE} from home`);
            continue;
        }

        let remote: Version;
        let local: Version;
        try {
            const version = JSON.parse(ns.read(tempFile));
            if (!isVersion(version))
                throw new Error(`version format unrecognized`);
            remote = version;
        } catch (err) {
            ns.print(`ERROR: failed to parse remote version: ${String(err)}`);
            continue;
        }

        try {
            const version = JSON.parse(ns.read(VERSION_FILE));
            if (!isVersion(version))
                throw new Error(`version format unrecognized`);
            local = version;
        } catch (err) {
            ns.print(`ERROR: failed to parse ${VERSION_FILE}: ${String(err)}`);
            continue;
        }

        if (remote.epoch > local.epoch && remote.sha !== local.sha) {
            const prompt =
                `A newer version of the scripts was published on ${remote.date}. `
                + `Download now?`;
            if (await ns.prompt(prompt)) {
                const file = 'external-bootstrap.js';
                if (await ns.wget(BOOTSTRAP_URL, file, 'home')) {
                    ns.exec(file, 'home');
                    return;
                }
                ns.print('ERROR: failed to download bootstrap.js');
            }
        }

        await ns.sleep(CONFIG.updateCheckIntervalMs);
    }
}
