import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const bag =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{}/=?,./<>?;:\'"`~'.split(
            '',
        );
    await tryDictionaryPasswords(ns);
    await tryBrute(ns, bag);
}

interface RainbowNS extends NS {
    rainbow(guess: string): boolean;
}

async function tryDictionaryPasswords(ns: NS) {
    for (const word of DICTIONARY) {
        for (const v of variations(word)) {
            (ns as RainbowNS).rainbow(v);
            await ns.sleep(0);
        }
    }
}

function* variations(word: string) {
    // TODO generate common passwordified variations of this word
    yield word;
}

async function tryBrute(ns: NS, bag: string[], maxLen = 12) {
    for (let len = 1; len <= maxLen; len++) {
        const idx = Array(len).fill(0);
        while (true) {
            const pw = idx.map((i) => bag[i]).join('');
            if ((ns as RainbowNS).rainbow(pw)) return true;
            // increment counter:
            let pos = len - 1;
            while (pos >= 0 && ++idx[pos] === bag.length) {
                idx[pos] = 0;
                pos--;
            }
            await ns.sleep(1);
            if (pos < 0) break;
        }
    }
    return false;
}

const DICTIONARY = [];
