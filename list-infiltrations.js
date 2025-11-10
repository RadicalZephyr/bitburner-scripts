import { parseFlags } from 'util/flags';
import { useNsUpdate, useTheme } from 'ui/hooks';
import { exitOnKill } from 'util/exitOnKill';
import { React } from 'lib/react';
export async function main(ns) {
    await parseFlags(ns, []);
    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.ui.moveTail(60, 350);
    ns.ui.resizeTail(825, 800);
    ns.clearLog();
    ns.printRaw(React.createElement(LocationBlock, { ns: ns }));
    return exitOnKill(ns);
}
function getInfiltrations(ns) {
    const infiltrations = ns.infiltration
        .getPossibleLocations()
        .map((loc) => ns.infiltration.getInfiltration(loc.name));
    const augInfiltrations = infiltrations
        .map(augmentInfiltration)
        .sort((a, b) => a.expPerAction - b.expPerAction);
    return augInfiltrations;
}
function augmentInfiltration(i) {
    return {
        expPerAction: i.reward.SoARep / i.maxClearanceLevel,
        ...i,
    };
}
function LocationBlock({ ns }) {
    const theme = useTheme(ns);
    const infiltrations = useNsUpdate(ns, 100, getInfiltrations);
    const cellStyle = { padding: '0 0.5em' };
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", null, "Infiltration Locations "),
        React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("th", { style: cellStyle }, "Difficulty"),
                React.createElement("th", { style: cellStyle }, "Start Sec Lvl"),
                React.createElement("th", { style: cellStyle }, "Max Clearance Lvl"),
                React.createElement("th", { style: cellStyle }, "Reward"),
                React.createElement("th", { style: cellStyle }, "XP/Action"),
                React.createElement("th", { style: cellStyle }, "City"),
                React.createElement("th", { style: cellStyle }, "Name")),
            infiltrations.map((infiltration, idx) => {
                return (React.createElement(LocationRow, { rowIndex: idx, infiltration: infiltration, cellStyle: cellStyle, theme: theme }));
            }))));
}
function LocationRow({ rowIndex, infiltration: location, cellStyle, theme, }) {
    return (React.createElement("tr", { key: location.location.name, style: rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well } },
        React.createElement("td", { style: cellStyle }, location.difficulty.toFixed(2)),
        React.createElement("td", { style: cellStyle }, location.startingSecurityLevel),
        React.createElement("td", { style: cellStyle }, location.maxClearanceLevel),
        React.createElement("td", { style: cellStyle }, location.reward.SoARep.toFixed(2)),
        React.createElement("td", { style: cellStyle }, location.expPerAction.toFixed(2)),
        React.createElement("td", { style: cellStyle }, location.location.city),
        React.createElement("td", { style: cellStyle }, location.location.name)));
}
