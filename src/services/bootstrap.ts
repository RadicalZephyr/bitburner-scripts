import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';
import { getSourceFileLevel } from 'services/client/source_file';

import { collectDependencies } from 'util/dependencies';

// NOTE: These flags _must_ be the same as in the root bootstrap script
// because we import and run this main function it sees the same
// arguments as the root bootstrap script received.
const FLAGS = [
    ['minimal', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    const host = ns.self().server;

    // We start the Discovery service first because everything else
    // needs the hosts and targets that it finds and cracks.
    startService(ns, '/services/discover.js', host);
    await ns.sleep(500);

    startService(ns, '/services/memory.js', host);
    startService(ns, '/services/launcher.js', host);

    const client = new LaunchClient(ns);

    const essentialServices = ['/services/port.js', '/services/source_file.js'];

    for (const script of essentialServices) {
        await client.launch(script, {
            threads: 1,
            alloc: { longRunning: true },
        });
    }

    if (flags.minimal) return;

    startService(ns, '/services/updater.js', 'n00dles');

    const sf4 = await getSourceFileLevel(ns, 4);

    if (sf4 === 0) {
        await client.launch('/services/backdoor-notify.js', {
            threads: 1,
            alloc: { longRunning: true },
        });
    }
}

function startService(ns: NS, script: string, host: string) {
    const scriptInfo = ns.getRunningScript(script, host);
    if (scriptInfo !== null) {
        ns.kill(scriptInfo.pid);
    }

    manualLaunch(ns, script, host);
}

function manualLaunch(ns: NS, script: string, hostname: string) {
    const dependencies = collectDependencies(ns, script);
    const files = [script, ...dependencies];
    if (!ns.scp(files, hostname, 'home')) {
        const error = `failed to send files to ${hostname}`;
        ns.toast(error, 'error');
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }

    const pid = ns.exec(script, hostname);
    if (pid === 0) {
        const error = `failed to launch ${script} on ${hostname}`;
        ns.toast(error, 'error');
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }
}
