import type { NS } from '@ns';
import { parseFlags } from 'util/flags';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    while (true) {
        await ns.share();
    }
}
