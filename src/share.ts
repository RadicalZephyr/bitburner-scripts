import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    while (true) {
        await ns.share();
    }
}
