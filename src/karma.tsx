import type { NS } from "netscript";

import { STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT } from "util/ui";

declare const React: any;

export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.setTailTitle("Karma");
    ns.ui.setTailFontSize(500);

    ns.ui.resizeTail(STATUS_WINDOW_WIDTH, 100);

    const cellStyle = {
        padding: "0 0.5em",
        textAlign: "left"
    } as const;

    while (true) {
        const [ww, wh] = ns.ui.windowSize();
        ns.ui.moveTail(ww - STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT);

        const player = ns.getPlayer();

        ns.clearLog();
        ns.printRaw((
            <>
                <table>
                    <tbody>
                        <trow><td style={cellStyle}>Karma: </td><td style={cellStyle}>{ns.formatNumber(player.karma)}</td></trow>
                        <trow><td style={cellStyle}>Victims: </td><td style={cellStyle}>{player.numPeopleKilled}</td></trow>
                    </tbody>
                </table>
            </>
        ));
        ns.ui.renderTail();

        await ns.sleep(200);
    }
}
