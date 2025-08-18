import type {
    NS,
    AutocompleteData,
    SleevePerson,
    UserInterfaceTheme,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { usePoll, useTheme } from 'util/hooks';
import { StatTracker } from 'util/stat-tracker';

import { CONFIG } from 'sleeve/config';

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

            const shockVelocity = tracker.averageVelocity(
                CONFIG.avgVelocityWindow,
                'shock',
            );
            const recoveredMs =
                shockVelocity < 0 ? -1 * (sp.shock / shockVelocity) * 1000 : 0;

            const syncedMs = calculateSyncTime(sp, tracker);

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
    const theme = useTheme(ns);
    const sleevesData = usePoll(ns, 1000, pollFn);
    const style = {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
    };

    return (
        <div className="MuiBox-root" style={style}>
            {sleevesData.map((sd, idx) => (
                <SleeveReady ns={ns} theme={theme} idx={idx} sleeveData={sd} />
            ))}
        </div>
    );
}

interface SleeveReadyProps {
    ns: NS;
    theme: UserInterfaceTheme;
    idx: number;
    sleeveData: SleeveData;
}

function SleeveReady({ ns, theme, idx, sleeveData }: SleeveReadyProps) {
    const style = {
        border: '1px solid rgb(68, 68, 68)',
    };
    return (
        <div
            style={style}
            className="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1"
        >
            <div>Sleeve {idx}:</div>
            <div>
                Recovered from Shock:
                <FinishTime
                    ns={ns}
                    theme={theme}
                    fromNow={sleeveData.recoveredMs}
                />
            </div>
            <div>
                Fully synced:
                <FinishTime
                    ns={ns}
                    theme={theme}
                    fromNow={sleeveData.syncedMs}
                />
            </div>
        </div>
    );
}

interface FinishTimeProps {
    ns: NS;
    theme: UserInterfaceTheme;
    fromNow: number;
}

function FinishTime({ ns, theme, fromNow }: FinishTimeProps) {
    if (isNaN(fromNow))
        return <div style={{ color: theme.error }}>Unknown</div>;
    if (!isFinite(fromNow))
        return <div style={{ color: theme.warning }}>Never (+∞)</div>;

    if (fromNow === 0) {
        return (
            <div>
                <span style={{ color: theme.success }}>Finished!</span>
            </div>
        );
    }

    const finishDate = new Date(Date.now() + fromNow);
    const h = ns.sprintf('%02d', finishDate.getHours());
    const m = ns.sprintf('%02d', finishDate.getMinutes());
    const s = ns.sprintf('%02d', finishDate.getSeconds());
    const time = `${h}:${m}:${s}`;
    return (
        <div>
            <span style={{ color: theme.cha }}>
                {finishDate.toDateString()} {time}
            </span>
            <span style={{ color: theme.info }}>(+{ns.tFormat(fromNow)})</span>
        </div>
    );
}

function calculateSyncTime(
    sleeve: SleevePerson,
    tracker: StatTracker<SleevePerson>,
): number {
    const syncVelocity = tracker.averageVelocity(
        CONFIG.avgVelocityWindow,
        'sync',
    );
    const syncDelta = 100 - sleeve.sync;

    if (syncVelocity > 0) {
        return (syncDelta / syncVelocity) * 1000;
    } else if (syncVelocity === 0) {
        if (Math.abs(syncDelta) > 0.0001) {
            return Infinity;
        } else {
            return 0;
        }
    } else {
        console.error('sleeve synchronization is decreasing!');
        return NaN;
    }
}
