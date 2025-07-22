import type { NS } from 'netscript';

import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { collectDependencies } from 'util/dependencies';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const host = ns.self().server;

    // We start the Discovery service first because everything else
    // needs the hosts and targets that it finds and cracks.
    startService(ns, '/services/discover.js', host);
    await ns.sleep(500);

    startService(ns, '/services/memory.js', host);
    startService(ns, '/services/port.js', host);

    startService(ns, '/services/updater.js', 'n00dles');

    startService(ns, '/services/backdoor-notify.js', host);
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
