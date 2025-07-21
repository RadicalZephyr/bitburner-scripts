import type { NS, UserInterfaceTheme } from "netscript";

import { CONFIG } from "corp/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let React: any;

export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    while (true) {
        const theme = ns.ui.getTheme();
        ns.clearLog();
        ns.printRaw(<EatIt theme={theme} />);
        ns.ui.renderTail();

        await ns.sleep(1000);
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
    const buttons = globalThis.document.getElementsByTagName("button");

    for (let i = 0; i < buttons.length; i++) {
        const b = buttons.item(i);
        if (b.innerText === 'Eat noodles')
            return b;
    }
    return null;
}

function stopEating() {
    if (typeof intervalId !== "number") return;

    globalThis.clearInterval(intervalId);
    intervalId = null;
}

interface IEatItProps {
    theme: UserInterfaceTheme;
}

function EatIt({ theme }: IEatItProps) {
    const buttonClass = "MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-u8jh2y";
    return (
        <>
            <h1>Eat All The Noodles!</h1>
            <button class={buttonClass} style={{ color: theme.successlight }} onClick={() => startEating()}>Eat it!<span class="MuiTouchRipple-root css-w0pj6f"></span></button>
            <button class={buttonClass} style={{ color: theme.errorlight }} onClick={() => stopEating()}>STOP!<span class="MuiTouchRipple-root css-w0pj6f"></span></button>
        </>
    );
}
