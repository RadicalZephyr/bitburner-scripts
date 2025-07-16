import type { NS } from "netscript";

export async function main(ns: NS) {
    const bag = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{}/=?,./<>?;:'\"`~".split('');
    await tryBrute(ns, bag);
}

async function tryDictionaryPasswords(ns: NS) {
    for (const word of DICTIONARY) {
        for (const v of variations(word)) {
            (ns as any).rainbow(v);
            await ns.sleep(0);
        }
    }
}

function* variations(word: string) {
    // TODO generate common passwordified variations of this word
}

async function tryBrute(ns: NS, bag: string[], maxLen = 12) {
    let calls = 0;
    for (let len = 1; len <= maxLen; len++) {
        const idx = Array(len).fill(0);
        while (true) {
            const pw = idx.map(i => bag[i]).join('');
            if ((ns as any).rainbow(pw)) return true;
            // increment counter:
            let pos = len - 1;
            while (pos >= 0 && ++idx[pos] === bag.length) {
                idx[pos] = 0;
                pos--;
            }
            if (pos < 0) break;
            if (++calls % 1000 === 0) await ns.sleep(0);
        }
    }
    return false;
}

async function tryRandomPasswords(ns: NS) {
    const bag = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{}/=?,./<>?;:'\"`~".split('');
    for (let len = 1; len < 10; len++) {
        for (const c of allCombinations(bag, len)) {
            let count = 0;
            for (const p of allPermutations(c)) {
                if ((ns as any).rainbow(p.join('')))
                    return;
                if (++count % 1000 === 0)
                    await ns.sleep(0);
            }
        }
    }
}

function countChoices(n: number, k: number): number {
    return fact(n) / (fact(k) * fact(n - k));
}

const fact = (() => {
    let mem = {};
    return (n: number) => {
        if (mem[n]) {
            return mem[n];
        } else {
            return n * fact(n - 1);
        }
    };
})();

function allCombinations<T>(items: T[], k: number) {
    // allcombinations () : return a list of all possible combinations

    let results = [];
    for (let slots = items.length; slots > 0; slots--) {
        for (let loop = 0; loop < items.length - slots + 1; loop++) {
            let key = results.length;
            results[key] = [];
            for (let i = loop; i < loop + slots; i++) {
                results[key].push(items[i]);
            }
        }
    }
    return results;
}

function allPermutations<T>(items: T[]) {
    // allPermutations () : return a list of all possible permutations
    // credits: https://stackoverflow.com/questions/9960908/permutations-in-javascript

    let results = [];
    function permute<T>(arr: T[], memo?: T[]) {
        var cur: T[], memo = memo || [];
        for (let i = 0; i < arr.length; i++) {
            cur = arr.splice(i, 1);
            if (arr.length === 0) {
                results.push(memo.concat(cur));
            }
            permute(arr.slice(), memo.concat(cur));
            arr.splice(i, 0, cur[0]);
        }
        return results;
    }
    permute(items);
    return results;
}

const DICTIONARY = [];
