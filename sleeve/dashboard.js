import { parseFlags } from 'util/flags';
import { usePoll, useTheme } from 'ui/hooks';
import { exitOnKill } from 'util/exitOnKill';
import { StatTracker } from 'util/stat-tracker';
import { React } from 'lib/react';
import { CONFIG } from 'sleeve/config';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
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
    const sleeveTrackers = [];
    const pollFn = () => {
        const sleeveData = [];
        for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
            const sp = ns.sleeve.getSleeve(i);
            if (i >= sleeveTrackers.length) {
                sleeveTrackers.push(new StatTracker(30));
            }
            const tracker = sleeveTrackers[i];
            tracker.update(sp);
            const shockVelocity = tracker.averageVelocity(CONFIG.avgVelocityWindow, 'shock');
            const recoveredMs = shockVelocity < 0 ? -1 * (sp.shock / shockVelocity) * 1000 : 0;
            const syncedMs = calculateSyncTime(sp, tracker);
            sleeveData.push({ recoveredMs, syncedMs, ...sp });
        }
        return sleeveData;
    };
    ns.ui.openTail();
    ns.printRaw(React.createElement(SleeveDashboard, { ns: ns, pollFn: pollFn }));
    ns.ui.renderTail();
    return exitOnKill(ns);
}
function SleeveDashboard({ ns, pollFn }) {
    const theme = useTheme(ns);
    const sleevesData = usePoll(ns, 1000, pollFn);
    const style = {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
    };
    return (React.createElement("div", { className: "MuiBox-root", style: style }, sleevesData.map((sd, idx) => (React.createElement(SleeveReady, { ns: ns, theme: theme, idx: idx, sleeveData: sd })))));
}
function SleeveReady({ ns, theme, idx, sleeveData }) {
    const style = {
        border: '1px solid rgb(68, 68, 68)',
    };
    return (React.createElement("div", { style: style, className: "MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1" },
        React.createElement("div", null,
            "Sleeve ",
            idx,
            ":"),
        React.createElement("div", null,
            "Recovered from Shock:",
            React.createElement(FinishTime, { ns: ns, theme: theme, fromNow: sleeveData.recoveredMs })),
        React.createElement("div", null,
            "Fully synced:",
            React.createElement(FinishTime, { ns: ns, theme: theme, fromNow: sleeveData.syncedMs }))));
}
function FinishTime({ ns, theme, fromNow }) {
    if (isNaN(fromNow))
        return React.createElement("div", { style: { color: theme.error } }, "Unknown");
    if (!isFinite(fromNow))
        return React.createElement("div", { style: { color: theme.warning } }, "Never (+\u221E)");
    if (fromNow === 0) {
        return (React.createElement("div", null,
            React.createElement("span", { style: { color: theme.success } }, "Finished!")));
    }
    const finishDate = new Date(Date.now() + fromNow);
    const h = ns.sprintf('%02d', finishDate.getHours());
    const m = ns.sprintf('%02d', finishDate.getMinutes());
    const s = ns.sprintf('%02d', finishDate.getSeconds());
    const time = `${h}:${m}:${s}`;
    return (React.createElement("div", null,
        React.createElement("span", { style: { color: theme.cha } },
            finishDate.toDateString(),
            " ",
            time),
        React.createElement("span", { style: { color: theme.info } },
            "(+",
            ns.tFormat(fromNow),
            ")")));
}
function calculateSyncTime(sleeve, tracker) {
    const syncVelocity = tracker.averageVelocity(CONFIG.avgVelocityWindow, 'sync');
    const syncDelta = 100 - sleeve.sync;
    if (syncVelocity > 0) {
        return (syncDelta / syncVelocity) * 1000;
    }
    else if (syncVelocity === 0) {
        if (Math.abs(syncDelta) > 0.0001) {
            return Infinity;
        }
        else {
            return 0;
        }
    }
    else {
        console.error('sleeve synchronization is decreasing!');
        return NaN;
    }
}
