import type { NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { getSourceFileLevel } from 'services/client/source_file';

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

    const eatFn = await searchForNoodles(ns);

    ns.clearLog();
    const WIDTH = 165;
    const HEIGHT = 235;
    ns.ui.resizeTail(WIDTH, HEIGHT);
    const [ww, wh] = ns.ui.windowSize();
    ns.ui.moveTail(ww - WIDTH, wh - HEIGHT);

    ns.printRaw(<EatIt ns={ns} eatFn={eatFn} />);
    ns.ui.renderTail();

    while (true) {
        await ns.asleep(60_000);
    }
}

type EatFn = () => undefined;

async function searchForNoodles(ns: NS): Promise<EatFn> {
    const sf4 = await getSourceFileLevel(ns, 4);
    if (sf4 > 0) {
        ns.singularity.travelToCity(ns.enums.CityName.NewTokyo);
        ns.singularity.goToLocation(ns.enums.LocationName.NewTokyoNoodleBar);
    } else {
        const message = 'Please travel to New Tokyo and enter the Noodle Bar!';
        ns.print(`WARN: ${message}`);
        ns.alert(message);
        while (!findEatNoodlesButton()) await ns.asleep(200);
    }

    const eatButton = findEatNoodlesButton();
    if (!eatButton) throw new Error('no eat button found');

    // Get the key for the React props object, which includes `on*`
    // event handler functions.
    const propsKey = Object.keys(eatButton)[1];
    const eatNoodles = eatButton[propsKey].onClick;
    if (!eatNoodles || typeof eatNoodles !== 'function')
        throw new Error('no EatNoodles click handler found');

    return eatNoodles satisfies EatFn;
}

function findEatNoodlesButton() {
    const unclickable = globalThis['unclickable'];
    if (!(unclickable instanceof Element)) {
        globalThis.console.log('no unclickable element found');
        return null;
    }

    const root = unclickable.parentElement;
    if (!(root instanceof Element)) {
        globalThis.console.log('no root element found');
        return null;
    }

    const buttons = root.getElementsByTagName('button');

    for (let i = 0; i < buttons.length; i++) {
        const b = buttons.item(i);
        if (b.innerText === 'Eat noodles') return b;
    }
    return null;
}

type MaybeInterval = number | null;

function startEating(
    eatNoodles: EatFn,
    interval: React.MutableRefObject<MaybeInterval>,
) {
    if (typeof interval.current === 'number') return;

    interval.current = globalThis.setInterval(
        eatNoodles,
        CONFIG.noodleEatingInterval,
    );
}

function stopEating(interval: React.MutableRefObject<MaybeInterval>) {
    if (typeof interval.current !== 'number') return;

    globalThis.clearInterval(interval.current);
    interval.current = null;
}

interface IEatItProps {
    ns: NS;
    eatFn: EatFn;
}

function EatIt({ ns, eatFn }: IEatItProps) {
    const theme = useTheme(ns);
    const interval: React.MutableRefObject<MaybeInterval> = React.useRef(null);

    const buttonClass =
        'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-u8jh2y css-13ak5e0';
    return (
        <>
            <h1>Eat All The Noodles!</h1>
            <button
                className={buttonClass}
                style={{ color: theme.successlight }}
                onClick={() => startEating(eatFn, interval)}
            >
                Eat it!<span className="MuiTouchRipple-root css-w0pj6f"></span>
            </button>
            <button
                className={buttonClass}
                style={{ color: theme.errorlight }}
                onClick={() => stopEating(interval)}
            >
                STOP!<span className="MuiTouchRipple-root css-w0pj6f"></span>
            </button>
        </>
    );
}
