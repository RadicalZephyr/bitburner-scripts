export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.moveTail(60, 350);
    ns.ui.resizeTail(825, 800);
    let infiltrations = ns.infiltration.getPossibleLocations().map((loc) => ns.infiltration.getInfiltration(loc.name));
    infiltrations.sort((a, b) => a.startingSecurityLevel - b.startingSecurityLevel);
    let theme = ns.ui.getTheme();
    ns.clearLog();
    ns.printRaw(React.createElement(LocationBlock, { infiltrations: infiltrations, theme: theme }));
}
function LocationBlock({ infiltrations, theme }) {
    const cellStyle = { padding: "0 0.5em" };
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", null, "Infiltration Locations "),
        React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("th", { style: cellStyle }, "Start Sec Lvl"),
                React.createElement("th", { style: cellStyle }, "Max Clearance Lvl"),
                React.createElement("th", { style: cellStyle }, "Difficulty"),
                React.createElement("th", { style: cellStyle }, "Reward"),
                React.createElement("th", { style: cellStyle }, "City"),
                React.createElement("th", { style: cellStyle }, "Name")),
            infiltrations.map((infiltration, idx) => {
                return React.createElement(LocationRow, { rowIndex: idx, infiltration: infiltration, cellStyle: cellStyle, theme: theme });
            }))));
}
function LocationRow({ rowIndex, infiltration: location, cellStyle, theme }) {
    return (React.createElement("tr", { key: location.location.name, style: rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well } },
        React.createElement("td", { style: cellStyle }, location.startingSecurityLevel),
        React.createElement("td", { style: cellStyle }, location.maxClearanceLevel),
        React.createElement("td", { style: cellStyle }, location.difficulty.toFixed(2)),
        React.createElement("td", { style: cellStyle }, location.reward.SoARep.toFixed(2)),
        React.createElement("td", { style: cellStyle }, location.location.city),
        React.createElement("td", { style: cellStyle }, location.location.name)));
}
