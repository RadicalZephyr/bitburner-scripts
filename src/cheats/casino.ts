import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { getSourceFileLevel } from 'services/client/source_file';

import { travelToCityForLocation } from 'automation/travel';

import { assertEl } from 'util/assertEl';
import { bindPropFn, getReactProps } from 'util/props';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
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

async function cheatTheHouse(ns: NS) {
    const coinFlipGame = await searchForCoinFlip(ns);

    const resultSequence = await getResultSequence(ns, coinFlipGame);

    await cheatAtCoinFlips(ns, coinFlipGame, resultSequence);
}

async function cheatAtCoinFlips(
    ns: NS,
    coinFlipGame: CoinFlipGameWithResult,
    results: HeadsOrTails[],
) {
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
        if (nextToss === HeadsOrTails.H) coinFlipGame.clickHeads();
        else if (nextToss === HeadsOrTails.T) coinFlipGame.clickTails();
        else
            throw new Error(
                'This should never happen, what did you do to my results array?!',
            );

        loops += 1;
    }
}

const HeadsOrTails = {
    H: 'h',
    T: 't',
} as const;
type HeadsOrTails = (typeof HeadsOrTails)[keyof typeof HeadsOrTails];

async function getResultSequence(
    ns: NS,
    coinFlipGame: CoinFlipGameWithResult,
): Promise<HeadsOrTails[]> {
    ns.print('Calculating sequence, wait here for a moment...');

    // Set bet to 1 while recording sequence
    coinFlipGame.bet(1);

    const flipCoin = () => {
        if (Math.random() > 0.5) coinFlipGame.clickHeads();
        else coinFlipGame.clickTails();
    };

    // Record sequence of results from the bad RNG for coin flipping
    const results: HeadsOrTails[] = [];
    for (let i = 0; i < coinFlipPeriod; i++) {
        flipCoin();
        results.push(flipResult(coinFlipGame.coinResult));
        if (i % 200 === 0) await ns.asleep(0);
    }

    return results;
}

function flipResult(coinResult: HTMLElement): HeadsOrTails {
    const flipText = (coinResult.textContent ?? '').trim();
    if (isHeads(flipText)) {
        return HeadsOrTails.H;
    } else if (isTails(flipText)) {
        return HeadsOrTails.T;
    } else {
        throw new Error(
            `Unknown flip result ${flipText}, did the html change?`,
        );
    }
}

const isHeads = (text: string) => text === 'H' || text === 'Head';
const isTails = (text: string) => text === 'T' || text === 'Tail';

interface CoinFlipGame {
    root: HTMLElement;
    bet(amount: number): void;
    clickHeads(): void;
    clickTails(): void;
}

interface CoinFlipGameWithResult extends CoinFlipGame {
    coinResult: HTMLParagraphElement;
}

async function searchForCoinFlip(ns: NS): Promise<CoinFlipGameWithResult> {
    const hasSF4 = (await getSourceFileLevel(ns, 4)) > 0;

    const root = assertEl(globalThis['root'], 'Could not find root element!');

    let message: string;
    if (hasSF4) {
        const casino = ns.enums.LocationName.AevumCasino;
        travelToCityForLocation(ns, casino);
        if (!ns.singularity.goToLocation(casino))
            throw new Error('failed to go to the Casino');

        message = 'Please open the coin flip game!';
    } else {
        message =
            'Please travel to Aevum and enter the Casino to the coin flip game!';
    }
    ns.print(`WARN: ${message}`);
    ns.alert(message);

    let coinFlip: CoinFlipGame | null;
    while (true) {
        coinFlip = findCoinFlipGame(root);
        if (coinFlip != null) break;
        await ns.asleep(200);
    }

    coinFlip.bet(1);
    coinFlip.clickHeads();

    const coinResult = findElementWithTagName(
        coinFlip.root,
        'p',
        (p) => isHeads(p.textContent) || isTails(p.textContent),
    );
    if (!coinResult)
        throw new Error('No coin result tag found! Did the game HTML change?');

    return { ...coinFlip, coinResult };
}

function findCoinFlipGame(root: Element): CoinFlipGame | null {
    const casinoHeading = findElementWithTagName(
        root,
        'h4',
        (h) => h.innerText === 'Iker Molina Casino',
    );
    if (!casinoHeading) return null;
    const gameRoot = casinoHeading.parentElement;

    const input = findElementWithTagName(gameRoot, 'input');
    if (!input) return null;

    const headButton = findElementWithTagName(
        gameRoot,
        'button',
        (b) => b.innerText === 'Head!',
    );
    const tailButton = findElementWithTagName(
        gameRoot,
        'button',
        (b) => b.innerText === 'Tail!',
    );

    if (headButton && tailButton) {
        const changeInput = bindPropFn(
            getReactProps(input),
            'onChange',
            'Error binding update input function',
        );

        const bet = (amount: number) => {
            input.value = String(amount);
            changeInput({
                currentTarget: { value: String(amount) },
                target: { value: String(amount) },
            });
        };

        const clickHeads = bindPropFn(
            getReactProps(headButton),
            'onClick',
            'Error binding click heads function',
            {
                isTrusted: true,
            },
        );
        const clickTails = bindPropFn(
            getReactProps(tailButton),
            'onClick',
            'Error binding click heads function',
            {
                isTrusted: true,
            },
        );

        return { root: gameRoot, bet, clickHeads, clickTails };
    }

    return null;
}

type TagPredFn<K extends keyof HTMLElementTagNameMap> = (
    k: HTMLElementTagNameMap[K],
) => boolean;

function findElementWithTagName<K extends keyof HTMLElementTagNameMap>(
    e: Element,
    tagName: K,
    pred?: TagPredFn<K>,
): HTMLElementTagNameMap[K] | null {
    const _pred = pred ?? (() => true);
    const tags = e.getElementsByTagName(tagName);
    for (let i = 0; i < tags.length; i++) {
        const t = tags.item(i);
        if (_pred(t)) return t;
    }
    return null;
}
