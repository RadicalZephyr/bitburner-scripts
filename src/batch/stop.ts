import type { NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';
import { killEverywhere } from 'util/kill';

export async function main(ns: NS) {
    const flags = ns.flags([['help', false], ...MEM_TAG_FLAGS]);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

This script gracefully shuts down the batch hacking system by killing all
harvest scripts and the manager, monitor, discovery and memory services.

OPTIONS:
--help         Show this help message

Example:
> run ${ns.getScriptName()}
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const scripts = ['batch/harvest.js', 'batch/sow.js', 'batch/till.js'];
    await killEverywhere(ns, ...scripts);
    await killEverywhere(ns, 'batch/h.js');
    await killEverywhere(ns, 'batch/g.js');
    await killEverywhere(ns, 'batch/w.js');

    const msg = 'stopped all batch hacking scripts';
    ns.toast(msg, 'success');
    ns.tprint('SUCCESS: ' + msg);
}
