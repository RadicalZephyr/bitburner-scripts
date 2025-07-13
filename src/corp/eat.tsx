import type { NS } from "netscript";

declare var React: any;

export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    while (true) {
        ns.clearLog();
        ns.printRaw(<EatIt />);
        ns.ui.renderTail();

        await ns.sleep(1000);
    }
}

let eating = false;

function startEating() {
    if (eating) return;

    eating = true;

    const eatButton = findEatNoodlesButton();

    let intervalId: number;
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

interface IEatItProps { }

function EatIt({ }: IEatItProps) {
    return (
        <>
            <h1>Eat All The Noodles!</h1>
            <a href="#" onClick={() => startEating()}>Eat it!</a>
        </>
    );
}
