import type { NS, AutocompleteData, SleevePerson } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { usePoll } from 'util/hooks';
import { StatTracker } from 'util/stat-tracker';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Display when sleeves will be fully de-shocked and synchronized.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    ns.disableLog('ALL');
    ns.clearLog();

    const sleeveTrackers: StatTracker<SleevePerson>[] = [];
    const pollFn = () => {
        const sleeveData = [];

        for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
            const sp = ns.sleeve.getSleeve(i);
            if (i >= sleeveTrackers.length) {
                sleeveTrackers.push(new StatTracker<SleevePerson>(30));
            }

            const tracker = sleeveTrackers[i];
            tracker.update(sp);

            const recoveredMs =
                -1 * (sp.shock / tracker.velocity('shock')) * 1000;
            const syncedMs =
                ((100 - sp.sync) / tracker.velocity('sync')) * 1000;

            sleeveData.push({ recoveredMs, syncedMs, ...sp });
        }

        return sleeveData;
    };

    ns.ui.openTail();
    ns.printRaw(<SleeveDashboard ns={ns} pollFn={pollFn} />);
    ns.ui.renderTail();

    while (true) {
        await ns.asleep(60_000);
    }
}

interface SleeveData extends SleevePerson {
    recoveredMs: number;
    syncedMs: number;
}

interface DashboardProps {
    ns: NS;
    pollFn: () => SleeveData[];
}

function SleeveDashboard({ ns, pollFn }: DashboardProps) {
    const sleevesData = usePoll(ns, 1000, pollFn);

    return (
        <div>
            {sleevesData.map((sd, idx) => (
                <SleeveReady ns={ns} idx={idx} sleeveData={sd} />
            ))}
        </div>
    );
}

interface SleeveReadyProps {
    ns: NS;
    idx: number;
    sleeveData: SleeveData;
}

function SleeveReady({ ns, idx, sleeveData }: SleeveReadyProps) {
    return (
        <div>
            <div>Sleeve {idx}:</div>
            <div>
                Recovered from Shock: {formatTime(ns, sleeveData.recoveredMs)}
            </div>
            <div>Fully synced: {formatTime(ns, sleeveData.syncedMs)}</div>
        </div>
    );
}

function formatTime(ns: NS, fromNow: number): string {
    if (isNaN(fromNow)) return 'unknown';
    if (!isFinite(fromNow)) return 'Never (+∞)';

    const finishDate = new Date(Date.now() + fromNow);
    return `${finishDate} (+${ns.tFormat(fromNow)})`;
}
