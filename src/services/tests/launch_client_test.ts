import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    const host = ns.getHostname();

    const memPid = ns.exec('/services/tests/mem_test.js', host);
    const launchPid = ns.exec('/services/launcher.js', host);
    if (memPid === 0 || launchPid === 0) {
        ns.tprintf('failed to start test services');
        return;
    }

    await ns.sleep(100);

    const client = new LaunchClient(ns);
    const res = await client.launch('/services/tests/test_app.js', {
        threads: 1,
    });
    ns.tprintf('launch result: %s', JSON.stringify(res));
    if (!res || res.allocation.allocationId !== 12) {
        ns.tprintf('ERROR: unexpected allocation id');
    }
    if (res && res.pids.length !== 0) {
        ns.tprintf('ERROR: expected no pids');
    }

    ns.kill(launchPid);
    ns.kill(memPid);
}
