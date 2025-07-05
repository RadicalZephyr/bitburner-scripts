import type { AutocompleteData, NS } from "netscript";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
}


interface Result {
    name: string;
    maxThreads: number;
    iterations: number;
    usedThreads: number;
    efficiency: number;
}

async function benchmark(
    ns: NS,
    fn: (ns: NS, t: string, m: number) => { n: number; growThreads: number; weakenThreads: number },
    name: string,
    target: string,
    maxThreadsList: number[]
): Promise<Result[]> {
    const results: Result[] = [];
    for (const m of maxThreadsList) {

        const { n, growThreads, weakenThreads } = fn(ns, target, m);

        const used = growThreads + weakenThreads;
        results.push({
            name,
            maxThreads: m,
            iterations: n,
            usedThreads: used,
            efficiency: used / m,
        });
    }
    return results;
}

function calculateSowThreadsForMaxThreads1(ns: NS, target: string, maxThreads: number) {
    let n = 0;
    let { growThreads, weakenThreads } = calculateSowBatchThreads(ns, target, maxThreads);
    while (growThreads + weakenThreads > maxThreads && growThreads > 0) {
        n++;
        growThreads--;
        ({ weakenThreads } = calculateSowBatchThreads(ns, target, growThreads));
    }
    return { growThreads, weakenThreads };
}

function calculateSowThreadsForMaxThreads2(ns: NS, target: string, maxThreads: number) {
    let n = 0;
    let { growThreads, weakenThreads } = calculateSowBatchThreads(ns, target, maxThreads);
    while (growThreads + weakenThreads > maxThreads && growThreads > 0) {
        n++;
        growThreads -= Math.ceil(weakenThreads / 3);
        ({ weakenThreads } = calculateSowBatchThreads(ns, target, growThreads));
    }
    return { ns, n, growThreads, weakenThreads };
}

function calculateSowThreadsForMaxThreads3(ns: NS, target: string, maxThreads: number) {
    let n = 0;
    let low = 0;
    let high = maxThreads;
    for (let i = 0; i < 16; i++) {
        n++;
        const mid = Math.floor((low + high) / 2);
        const { growThreads, weakenThreads } = calculateSowBatchThreads(ns, target, mid);
        if (growThreads + weakenThreads === maxThreads) {
            low = mid;
            break;
        } else if (growThreads + weakenThreads < maxThreads) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return { ns, n, ...calculateSowBatchThreads(ns, target, low) };
}

function calculateSowBatchThreads(ns: NS, target: string, growThreads: number) {
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}

function weakenAnalyze(weakenAmount: number): number {
    if (weakenAmount <= 0) return 0;

    return Math.ceil(weakenAmount * 20) + 1;
}
