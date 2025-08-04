import type {
    ILocation,
    InfiltrationLocation,
    NS,
    UserInterfaceTheme,
} from 'netscript';
import { parseFlags } from 'util/flags';

import { useNsUpdate } from 'util/useNsUpdate';
import { useTheme } from 'util/useTheme';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.ui.moveTail(60, 350);
    ns.ui.resizeTail(825, 800);

    ns.clearLog();
    ns.printRaw(<LocationBlock ns={ns} />);

    while (true) {
        await ns.asleep(60_000);
    }
}

function getInfiltrations(ns: NS) {
    const infiltrations = ns.infiltration
        .getPossibleLocations()
        .map((loc: ILocation) => ns.infiltration.getInfiltration(loc.name));

    const augInfiltrations = infiltrations
        .map(augmentInfiltration)
        .sort((a, b) => a.expPerAction - b.expPerAction);

    return augInfiltrations;
}

function augmentInfiltration(i: InfiltrationLocation): RatedInfiltrationLoc {
    return {
        expPerAction: i.reward.SoARep / i.maxClearanceLevel,
        ...i,
    };
}

interface RatedInfiltrationLoc extends InfiltrationLocation {
    expPerAction: number;
}

interface IBlockSettings {
    ns: NS;
}

function LocationBlock({ ns }: IBlockSettings) {
    const theme = useTheme(ns);
    const infiltrations = useNsUpdate(ns, 100, getInfiltrations);

    const cellStyle = { padding: '0 0.5em' };
    return (
        <>
            <h2>Infiltration Locations </h2>
            <table>
                <thead>
                    <th style={cellStyle}>Difficulty</th>
                    <th style={cellStyle}>Start Sec Lvl</th>
                    <th style={cellStyle}>Max Clearance Lvl</th>
                    <th style={cellStyle}>Reward</th>
                    <th style={cellStyle}>XP/Action</th>
                    <th style={cellStyle}>City</th>
                    <th style={cellStyle}>Name</th>
                </thead>
                {infiltrations.map((infiltration, idx) => {
                    return (
                        <LocationRow
                            rowIndex={idx}
                            infiltration={infiltration}
                            cellStyle={cellStyle}
                            theme={theme}
                        ></LocationRow>
                    );
                })}
            </table>
        </>
    );
}

interface IRowSettings {
    rowIndex: number;
    infiltration: RatedInfiltrationLoc;
    cellStyle: object;
    theme: UserInterfaceTheme;
}

function LocationRow({
    rowIndex,
    infiltration: location,
    cellStyle,
    theme,
}: IRowSettings) {
    return (
        <tr
            key={location.location.name}
            style={
                rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well }
            }
        >
            <td style={cellStyle}>{location.difficulty.toFixed(2)}</td>
            <td style={cellStyle}>{location.startingSecurityLevel}</td>
            <td style={cellStyle}>{location.maxClearanceLevel}</td>
            <td style={cellStyle}>{location.reward.SoARep.toFixed(2)}</td>
            <td style={cellStyle}>{location.expPerAction.toFixed(2)}</td>
            <td style={cellStyle}>{location.location.city}</td>
            <td style={cellStyle}>{location.location.name}</td>
        </tr>
    );
}
