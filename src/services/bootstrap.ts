import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';

import { collectDependencies } from 'util/dependencies';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    const host = ns.self().server;

    // We start the Discovery service first because everything else
    // needs the hosts and targets that it finds and cracks.
    startService(ns, '/services/discover.js', host);
    await ns.sleep(500);

    startService(ns, '/services/memory.js', host);
    startService(ns, '/services/launcher.js', host);

    startService(ns, '/services/updater.js', 'n00dles');

    const client = new LaunchClient(ns);

    const services = [
        '/services/source_file.js',
        '/services/port.js',
        '/services/backdoor-notify.js',
    ];

    for (const script of services) {
        await client.launch(script, {
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
