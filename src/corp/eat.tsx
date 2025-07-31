import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { useTheme } from 'util/useTheme';

import { CONFIG } from 'corp/config';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();

    ns.clearLog();
    ns.printRaw(<EatIt ns={ns} />);
    ns.ui.renderTail();

    while (true) {
        await ns.asleep(60_000);
    }
}

let eating = false;
let intervalId: number;

function startEating() {
    if (eating) return;

    eating = true;

    const eatButton = findEatNoodlesButton();

    intervalId = globalThis.setInterval(() => {
        if (eatButton) {
            eatButton.click();
        } else {
            globalThis.clearInterval(intervalId);
            eating = false;
        }
    }, CONFIG.noodleEatingInterval);
}

function findEatNoodlesButton() {
    const buttons = globalThis.document.getElementsByTagName('button');

    for (let i = 0; i < buttons.length; i++) {
        const b = buttons.item(i);
        if (b.innerText === 'Eat noodles') return b;
    }
    return null;
}

function stopEating() {
    if (typeof intervalId !== 'number') return;

    globalThis.clearInterval(intervalId);
    intervalId = null;
}

interface IEatItProps {
    ns: NS;
}

function EatIt({ ns }: IEatItProps) {
    const theme = useTheme(ns);

    const buttonClass =
        'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-u8jh2y';
    return (
        <>
            <h1>Eat All The Noodles!</h1>
            <button
                className={buttonClass}
                style={{ color: theme.successlight }}
                onClick={() => startEating()}
            >
                Eat it!<span className="MuiTouchRipple-root css-w0pj6f"></span>
            </button>
            <button
                className={buttonClass}
                style={{ color: theme.errorlight }}
                onClick={() => stopEating()}
            >
                STOP!<span className="MuiTouchRipple-root css-w0pj6f"></span>
            </button>
        </>
    );
}
