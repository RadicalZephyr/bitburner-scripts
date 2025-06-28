import type { ILocation, InfiltrationLocation, NS, UserInterfaceTheme } from "netscript";

declare const React: any;

export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.moveTail(60, 350);
    ns.ui.resizeTail(825, 800);

    let infiltrations = ns.infiltration.getPossibleLocations().map((loc: any) => ns.infiltration.getInfiltration(loc.name));

    infiltrations.sort((a, b) => a.startingSecurityLevel - b.startingSecurityLevel);

    let theme = ns.ui.getTheme();

    ns.clearLog();
    ns.printRaw(<LocationBlock infiltrations={infiltrations} theme={theme}></LocationBlock>);
}

interface IBlockSettings {
    infiltrations: InfiltrationLocation[],
    theme: UserInterfaceTheme,
}

function LocationBlock({ infiltrations, theme }: IBlockSettings) {
    const cellStyle = { padding: "0 0.5em" };
    return (<>
        <h2>Infiltration Locations </h2>
        <table>
            <thead>
                <th style={cellStyle}>Start Sec Lvl</th>
                <th style={cellStyle}>Max Clearance Lvl</th>
                <th style={cellStyle}>Difficulty</th>
                <th style={cellStyle}>Reward</th>
                <th style={cellStyle}>City</th>
                <th style={cellStyle}>Name</th>
            </thead>
            {
                infiltrations.map((infiltration, idx) => {
                    return <LocationRow rowIndex={idx} infiltration={infiltration} cellStyle={cellStyle} theme={theme}></LocationRow>;
                })
            }
        </table>
    </>);
}

interface IRowSettings {
    rowIndex: number,
    infiltration: InfiltrationLocation,
    cellStyle: any,
    theme: UserInterfaceTheme,
}

function LocationRow({ rowIndex, infiltration: location, cellStyle, theme }: IRowSettings) {
    return (
        <tr key={location.location.name} style={rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well }}>
            <td style={cellStyle}>{location.startingSecurityLevel}</td>
            <td style={cellStyle}>{location.maxClearanceLevel}</td>
            <td style={cellStyle}>{location.difficulty.toFixed(2)}</td>
            <td style={cellStyle}>{location.reward.SoARep.toFixed(2)}</td>
            <td style={cellStyle}>{location.location.city}</td>
            <td style={cellStyle}>{location.location.name}</td>
        </tr>
    );
}
