import { MEM_TAG_FLAGS } from "services/client/memory_tag";
import { STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT, KARMA_HEIGHT } from "util/ui";
export async function main(ns) {
    const flags = ns.flags(MEM_TAG_FLAGS);
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.setTailTitle("Karma");
    ns.ui.setTailFontSize(500);
    ns.ui.resizeTail(STATUS_WINDOW_WIDTH, KARMA_HEIGHT);
    const cellStyle = {
        padding: "0 0.5em",
        textAlign: "left"
    };
    while (true) {
        const [ww, wh] = ns.ui.windowSize();
        ns.ui.moveTail(ww - STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT);
        const player = ns.getPlayer();
        ns.clearLog();
        ns.printRaw((React.createElement(React.Fragment, null,
            React.createElement("table", null,
                React.createElement("tbody", null,
                    React.createElement("trow", null,
                        React.createElement("td", { style: cellStyle }, "Karma: "),
                        React.createElement("td", { style: cellStyle }, ns.formatNumber(player.karma))),
                    React.createElement("trow", null,
                        React.createElement("td", { style: cellStyle }, "Victims: "),
                        React.createElement("td", { style: cellStyle }, player.numPeopleKilled)))))));
        ns.ui.renderTail();
        await ns.sleep(200);
    }
}
