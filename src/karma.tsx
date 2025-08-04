import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { useNsUpdate } from 'util/useNsUpdate';

import {
    STATUS_WINDOW_WIDTH,
    STATUS_WINDOW_HEIGHT,
    KARMA_HEIGHT,
} from 'util/ui';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.ui.setTailTitle('Karma');
    ns.ui.setTailFontSize(500);

    ns.ui.resizeTail(STATUS_WINDOW_WIDTH, KARMA_HEIGHT);

    const cellStyle = {
        padding: '0 0.5em',
        textAlign: 'left',
    } as const;

    ns.clearLog();
    ns.printRaw(<Karma ns={ns} cellStyle={cellStyle} />);
    ns.ui.renderTail();

    while (true) {
        const [ww] = ns.ui.windowSize();
        ns.ui.moveTail(ww - STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT);
        await ns.asleep(1000);
    }
}

interface KarmaProps {
    ns: NS;
    cellStyle: object;
}

function Karma({ ns, cellStyle }: KarmaProps) {
    const karmaStats = useNsUpdate(ns, 100, getKarma);

    return (
        <>
            <table>
                <tbody>
                    <tr>
                        <td style={cellStyle}>Karma: </td>
                        <td style={cellStyle}>
                            {ns.formatNumber(karmaStats.karma)}
                        </td>
                    </tr>
                    <tr>
                        <td style={cellStyle}>Victims: </td>
                        <td style={cellStyle}>{karmaStats.numKilled}</td>
                    </tr>
                </tbody>
            </table>
        </>
    );
}

interface KarmaStats {
    karma: number;
    numKilled: number;
}

function getKarma(ns: NS): KarmaStats {
    const player = ns.getPlayer();
    const karma = player.karma;
    const numKilled = player.numPeopleKilled;
    return { karma, numKilled };
}
