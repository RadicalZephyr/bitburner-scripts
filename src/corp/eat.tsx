import type { NS, UserInterfaceTheme } from "netscript";

declare var React: any;

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
    }, 100);
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
    const buttonStyle = { backgroundColor: theme.well, padding: "2em", margin: "0.5em" };
    return (
        <>
            <h1>Eat All The Noodles!</h1>
            <a href="#" style={{ color: theme.successlight, ...buttonStyle }} onClick={() => startEating()}>Eat it!</a>
            <a href="#" style={{ color: theme.errorlight, ...buttonStyle }} onClick={() => stopEating()}>STOP!</a>
        </>
    );
}
