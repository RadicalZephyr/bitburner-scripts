import type { NS } from "netscript";

declare const React: any;

export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.setTailTitle("Karma");
    ns.ui.setTailFontSize(500);


    const WIDTH = 180;
    ns.ui.resizeTail(WIDTH, 100);

    const cellStyle = {
        padding: "0 0.5em",
        textAlign: "left"
    } as const;

    while (true) {
        const working = true;
        const tailY = working ? 320 : 450;
        const [ww, wh] = ns.ui.windowSize();
        ns.ui.moveTail(ww - WIDTH, tailY);

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
