import type { NS } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { getSourceFileLevel } from 'services/client/source_file';

import { travelToCityForLocation } from 'automation/travel';

import { exitOnKill } from 'util/exitOnKill';
import { makeFuid } from 'util/fuid';
import { useTheme } from 'util/hooks';
import { getReactProps } from 'util/props';

import { React } from 'lib/react';

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

    const { className, eatFn } = await searchForNoodles(ns);

    ns.clearLog();
    const WIDTH = 165;
    const HEIGHT = 235;
    ns.ui.resizeTail(WIDTH, HEIGHT);
    const [ww, wh] = ns.ui.windowSize();
    ns.ui.moveTail(ww - WIDTH, wh - HEIGHT);

    ns.printRaw(<EatIt ns={ns} className={className} eatFn={eatFn} />);
    ns.ui.renderTail();

    return exitOnKill(ns);
}

interface EatButton {
    className: string;
    eatFn: EatFn;
}

type EatFn = () => void;

async function searchForNoodles(ns: NS): Promise<EatButton> {
    const sf4 = await getSourceFileLevel(ns, 4);
    if (sf4 > 0) {
        const noodleBar = ns.enums.LocationName.NewTokyoNoodleBar;
        travelToCityForLocation(ns, noodleBar);
        if (!ns.singularity.goToLocation(noodleBar))
            throw new Error('failed to go to Noodle Bar');
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
    const eatButtonProps = getReactProps(eatButton);

    const className =
        typeof eatButtonProps.className === 'string'
            ? eatButtonProps.className
            : '';

    const eatNoodles = eatButtonProps.onClick;
    if (!eatNoodles || typeof eatNoodles !== 'function')
        throw new Error('no EatNoodles click handler found');

    return {
        className,
        eatFn: eatNoodles as EatFn,
    };
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
    ns: NS,
    eatNoodles: EatFn,
    interval: React.MutableRefObject<MaybeInterval>,
) {
    if (typeof interval.current === 'number') return;

    interval.current = globalThis.setInterval(
        eatNoodles,
        CONFIG.noodleEatingInterval,
    );

    ns.alert('We started eating noodles!');

    ns.atExit(
        () => {
            if (typeof interval.current === 'number')
                globalThis.clearInterval(interval.current);
        },
        'eatNoodlesCleanup-' + makeFuid(ns),
    );
}

function stopEating(ns: NS, interval: React.MutableRefObject<MaybeInterval>) {
    if (typeof interval.current !== 'number') return;

    globalThis.clearInterval(interval.current);
    interval.current = null;

    ns.alert(
        'Okay, we stopped eating noodles! It might take a while for all the toast popups to go away though. We ate a lot of noodles!',
    );
}

interface IEatItProps {
    ns: NS;
    className: string;
    eatFn: EatFn;
}

function EatIt({ ns, className, eatFn }: IEatItProps) {
    const theme = useTheme(ns);
    const interval: React.MutableRefObject<MaybeInterval> = React.useRef(null);
    const [bowlsEaten, eatBowl] = React.useState(0);
    const eatAndCount = () => {
        eatBowl((n) => n + 1);
        eatFn();
    };
    return (
        <div>
            <h1>Eat All The Noodles!</h1>
            <h3>Bowls eaten: {bowlsEaten}</h3>
            <button
                className={className}
                style={{ color: theme.successlight }}
                onClick={() => startEating(ns, eatAndCount, interval)}
            >
                Eat it!<span className="MuiTouchRipple-root css-w0pj6f"></span>
            </button>
            <button
                className={className}
                style={{ color: theme.errorlight }}
                onClick={() => stopEating(ns, interval)}
            >
                STOP!<span className="MuiTouchRipple-root css-w0pj6f"></span>
            </button>
        </div>
    );
}
