import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { sleep } from 'util/time';

const PORT_SYNC = 98; // control channel
const PORT_DATA = 99; // channel under test

const FLAGS = [
    ['trials', 20_000],
    ['timeout', 50],
    ['work', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Test whether it's safe to check a port is empty and then subscribe to nextWrite promise.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await doRaceTest(ns, flags);
}

interface Options {
    trials: number;
    timeout: number;
    work: boolean;
}

async function doRaceTest(ns: NS, opts: Options) {
    const sync = ns.getPortHandle(PORT_SYNC);
    const data = ns.getPortHandle(PORT_DATA);
    sync.clear();
    data.clear();

    let misses = 0;
    for (let i = 0; i < opts.trials; i++) {
        // Tell sender to write *now*
        sync.write(i);

        // Replicate the “racy” pattern: check-empty then subscribe.
        if (data.empty()) {
            // Extend the time between check and subscribe
            if (opts.work) {
                for (let j = 0; j < 10_000; j++) {
                    console.log(`thing j=${j}`);
                }
            }

            const next = data.nextWrite(); // subscribe
            // If a write snuck in between empty() and nextWrite(),
            // next won't resolve (it waits for a *future* write).
            const won = await Promise.race([
                next.then(() => 'next'),
                sleep(opts.timeout).then(() => 'timeout'),
            ]);

            if (won === 'timeout') {
                // If the queue is *not* empty now, we likely missed the signal.
                if (!data.empty()) {
                    ns.print('missed write!');
                    misses++;
                    data.read(); // consume the queued reply to keep the loop going
                }
            } else {
                // nextWrite() resolved; consume the queued reply
                data.read();
            }
        } else {
            // Unexpected leftover data; consume to keep clean
            data.read();
        }

        // Give the sender a scheduling breather
        if (i % 100 === 0) await ns.sleep(1);
    }

    ns.tprint(`Trials=${opts.trials}  missed-signal occurrences=${misses}`);
}
