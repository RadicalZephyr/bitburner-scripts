import type { NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { useTheme } from 'util/hooks';

import { CONFIG } from 'corp/config';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help || (flags._ as string[]).length !== 0) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Display buttons to automatically eat corporation noodles.

OPTIONS
  --help   Show this help message

CONFIGURATION
  CORP_noodleEatingInterval  Time in ms between button presses
`);
        return;
    }

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
        'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-u8jh2y css-13ak5eo';
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
