import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import {
  STATUS_WINDOW_WIDTH,
  STATUS_WINDOW_HEIGHT,
  KARMA_HEIGHT,
} from 'util/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const React: any;

export async function main(ns: NS) {
  ns.flags(MEM_TAG_FLAGS);
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.setTailTitle('Karma');
  ns.ui.setTailFontSize(500);

  ns.ui.resizeTail(STATUS_WINDOW_WIDTH, KARMA_HEIGHT);

  const cellStyle = {
    padding: '0 0.5em',
    textAlign: 'left',
  } as const;

  while (true) {
    const [ww] = ns.ui.windowSize();
    ns.ui.moveTail(ww - STATUS_WINDOW_WIDTH, STATUS_WINDOW_HEIGHT);

    const player = ns.getPlayer();

    ns.clearLog();
    ns.printRaw(
      <>
        <table>
          <tbody>
            <trow>
              <td style={cellStyle}>Karma: </td>
              <td style={cellStyle}>{ns.formatNumber(player.karma)}</td>
            </trow>
            <trow>
              <td style={cellStyle}>Victims: </td>
              <td style={cellStyle}>{player.numPeopleKilled}</td>
            </trow>
          </tbody>
        </table>
      </>,
    );
    ns.ui.renderTail();

    await ns.sleep(200);
  }
}
