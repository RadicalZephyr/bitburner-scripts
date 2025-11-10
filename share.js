import { parseFlags } from 'util/flags';
export async function main(ns) {
    await parseFlags(ns, []);
    while (true) {
        await ns.share();
    }
}
