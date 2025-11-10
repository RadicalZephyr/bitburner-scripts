import { parseFlags } from 'util/flags';
import { STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT, KARMA_HEIGHT, } from 'ui/constants';
import { useNsUpdate } from 'ui/hooks';
import { React } from 'lib/react';
export async function main(ns) {
    await parseFlags(ns, []);
    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.ui.setTailTitle('Karma');
    ns.ui.setTailFontSize(500);
    ns.ui.resizeTail(STATUS_WINDOW_WIDTH, KARMA_HEIGHT);
    const cellStyle = {
        padding: '0 0.5em',
        textAlign: 'left',
    };
    ns.clearLog();
    ns.printRaw(React.createElement(Karma, { ns: ns, cellStyle: cellStyle }));
    ns.ui.renderTail();
    while (true) {
        const [ww] = ns.ui.windowSize();
        ns.ui.moveTail(ww - STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT);
        await ns.asleep(1000);
    }
}
function Karma({ ns, cellStyle }) {
    const karmaStats = useNsUpdate(ns, 100, getKarma);
    return (React.createElement(React.Fragment, null,
        React.createElement("table", null,
            React.createElement("tbody", null,
                React.createElement("tr", null,
                    React.createElement("td", { style: cellStyle }, "Karma: "),
                    React.createElement("td", { style: cellStyle }, ns.formatNumber(karmaStats.karma))),
                React.createElement("tr", null,
                    React.createElement("td", { style: cellStyle }, "Victims: "),
                    React.createElement("td", { style: cellStyle }, karmaStats.numKilled))))));
}
function getKarma(ns) {
    const player = ns.getPlayer();
    const karma = player.karma;
    const numKilled = player.numPeopleKilled;
    return { karma, numKilled };
}
