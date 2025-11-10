import { parseFlags } from 'util/flags';
import { getSourceFileLevel } from 'services/client/reset-info';
import { travelToCityForLocation } from 'automation/travel';
import { assertEl } from 'util/assertEl';
import { bindPropFn, getReactProps } from 'util/props';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Win money by cheating at coin flips!

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }
    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();
    await cheatTheHouse(ns);
}
const coinFlipPeriod = 1024;
const maxCoinFlipBet = 10_000;
const maxCasinoWinnings = 10_000_000_000;
async function cheatTheHouse(ns) {
    const coinFlipGame = await searchForCoinFlip(ns);
    const resultSequence = await getResultSequence(ns, coinFlipGame);
    await cheatAtCoinFlips(ns, coinFlipGame, resultSequence);
}
async function cheatAtCoinFlips(ns, coinFlipGame, results) {
    // Set bet to max value
    coinFlipGame.bet(maxCoinFlipBet);
    ns.print('Finished calculating. You can leave the casino now!');
    const getCasinoWinnings = () => ns.getMoneySources().sinceInstall.casino;
    let loops = 0;
    while (getCasinoWinnings() < maxCasinoWinnings) {
        if (loops % 200 == 0) {
            await ns.asleep(0);
        }
        const nextToss = results[loops % coinFlipPeriod];
        if (nextToss === HeadsOrTails.H)
            coinFlipGame.clickHeads();
        else if (nextToss === HeadsOrTails.T)
            coinFlipGame.clickTails();
        else
            throw new Error('This should never happen, what did you do to my results array?!');
        loops += 1;
    }
}
const HeadsOrTails = {
    H: 'h',
    T: 't',
};
async function getResultSequence(ns, coinFlipGame) {
    ns.print('Calculating sequence, wait here for a moment...');
    // Set bet to 1 while recording sequence
    coinFlipGame.bet(1);
    const flipCoin = () => {
        if (Math.random() > 0.5)
            coinFlipGame.clickHeads();
        else
            coinFlipGame.clickTails();
    };
    // Record sequence of results from the bad RNG for coin flipping
    const results = [];
    for (let i = 0; i < coinFlipPeriod; i++) {
        flipCoin();
        results.push(flipResult(coinFlipGame.coinResult));
        if (i % 200 === 0)
            await ns.asleep(0);
    }
    return results;
}
function flipResult(coinResult) {
    const flipText = (coinResult.textContent ?? '').trim();
    if (isHeads(flipText)) {
        return HeadsOrTails.H;
    }
    else if (isTails(flipText)) {
        return HeadsOrTails.T;
    }
    else {
        throw new Error(`Unknown flip result ${flipText}, did the html change?`);
    }
}
const isHeads = (text) => text === 'H' || text === 'Head';
const isTails = (text) => text === 'T' || text === 'Tail';
async function searchForCoinFlip(ns) {
    const hasSF4 = getSourceFileLevel(4) > 0;
    const root = assertEl(globalThis['document'].getElementById('root'), 'Could not find root element!');
    let message;
    if (hasSF4) {
        const casino = ns.enums.LocationName.AevumCasino;
        travelToCityForLocation(ns, casino);
        if (!ns.singularity.goToLocation(casino))
            throw new Error('failed to go to the Casino');
        message = 'Please open the coin flip game!';
    }
    else {
        message =
            'Please travel to Aevum and enter the Casino to the coin flip game!';
    }
    ns.print(`WARN: ${message}`);
    ns.alert(message);
    let coinFlip;
    while (true) {
        coinFlip = findCoinFlipGame(root);
        if (coinFlip != null)
            break;
        await ns.asleep(200);
    }
    coinFlip.bet(1);
    coinFlip.clickHeads();
    const coinResult = findElementWithTagName(coinFlip.root, 'p', (p) => isHeads(p.textContent) || isTails(p.textContent));
    if (!coinResult)
        throw new Error('No coin result tag found! Did the game HTML change?');
    return { ...coinFlip, coinResult };
}
function findCoinFlipGame(root) {
    const casinoHeading = findElementWithTagName(root, 'h4', (h) => h.innerText === 'Iker Molina Casino');
    if (!casinoHeading)
        return null;
    const gameRoot = casinoHeading.parentElement;
    const input = findElementWithTagName(gameRoot, 'input');
    if (!input)
        return null;
    const headButton = findElementWithTagName(gameRoot, 'button', (b) => b.innerText === 'Head!');
    const tailButton = findElementWithTagName(gameRoot, 'button', (b) => b.innerText === 'Tail!');
    if (headButton && tailButton) {
        const changeInput = bindPropFn(getReactProps(input), 'onChange', 'Error binding update input function');
        const bet = (amount) => {
            input.value = String(amount);
            changeInput({
                currentTarget: { value: String(amount) },
                target: { value: String(amount) },
            });
        };
        const clickHeads = bindPropFn(getReactProps(headButton), 'onClick', 'Error binding click heads function', {
            isTrusted: true,
        });
        const clickTails = bindPropFn(getReactProps(tailButton), 'onClick', 'Error binding click heads function', {
            isTrusted: true,
        });
        return { root: gameRoot, bet, clickHeads, clickTails };
    }
    return null;
}
function findElementWithTagName(e, tagName, pred) {
    const _pred = pred ?? (() => true);
    const tags = e.getElementsByTagName(tagName);
    for (let i = 0; i < tags.length; i++) {
        const t = tags.item(i);
        if (_pred(t))
            return t;
    }
    return null;
}
