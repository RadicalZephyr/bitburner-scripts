import { CONFIG } from "corp/config";
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();
    while (true) {
        const theme = ns.ui.getTheme();
        ns.clearLog();
        ns.printRaw(React.createElement(EatIt, { theme: theme }));
        ns.ui.renderTail();
        await ns.sleep(1000);
    }
}
let eating = false;
let intervalId;
function startEating() {
    if (eating)
        return;
    eating = true;
    const eatButton = findEatNoodlesButton();
    intervalId = globalThis.setInterval(() => {
        if (eatButton) {
            eatButton.click();
        }
        else {
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
    if (typeof intervalId !== "number")
        return;
    globalThis.clearInterval(intervalId);
    intervalId = null;
}
function EatIt({ theme }) {
    const buttonClass = "MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-u8jh2y";
    return (React.createElement(React.Fragment, null,
        React.createElement("h1", null, "Eat All The Noodles!"),
        React.createElement("button", { class: buttonClass, style: { color: theme.successlight }, onClick: () => startEating() },
            "Eat it!",
            React.createElement("span", { class: "MuiTouchRipple-root css-w0pj6f" })),
        React.createElement("button", { class: buttonClass, style: { color: theme.errorlight }, onClick: () => stopEating() },
            "STOP!",
            React.createElement("span", { class: "MuiTouchRipple-root css-w0pj6f" }))));
}
