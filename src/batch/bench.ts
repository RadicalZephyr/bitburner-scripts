import type { AutocompleteData, NS } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ["help", false],
        ...MEM_TAG_FLAGS
    ]);

    const targets = (flags._ as string[]).filter((t) => typeof t === "string");
    if (targets.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} TARGET [...TARGETS]

Benchmark sow thread allocation algorithms on TARGETS.

OPTIONS
  --help   Show this help message
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    ns.disableLog("ALL");

    const maxThreadsList = [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384];
    const algos: [
        (ns: NS, t: string, m: number) => { n: number; growThreads: number; weakenThreads: number },
        string
    ][] = [
            [calculateSowThreadsForMaxThreads1, "v1"],
            [calculateSowThreadsForMaxThreads2, "v2"],
            [calculateSowThreadsForMaxThreads3, "v3"],
        ];

    for (const target of targets) {
        if (!ns.serverExists(target)) {
            ns.print(`WARN: target ${target} does not exist`);
            continue;
        }

        ns.print(`INFO: benchmarking ${target}`);

        for (const [fn, name] of algos) {
            const results = await benchmark(ns, fn, name, target, maxThreadsList);

            const iters = results.map((r) => r.iterations);
            const wastes = results.map((r) => r.maxThreads - r.usedThreads);

            const iterMean = mean(iters);
            const iterMed = median(iters);
            const wasteMean = mean(wastes);
            const wasteStd = std(wastes);

            ns.print(
                `INFO: ${target} ${name} μ=${ns.formatNumber(iterMean)} ` +
                `median=${ns.formatNumber(iterMed)} ` +
                `Δ=${ns.formatNumber(wasteMean)} σ=${ns.formatNumber(wasteStd)}`
            );
            await ns.sleep(10);
        }
    }
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
    return { n, growThreads, weakenThreads };
}

function calculateSowThreadsForMaxThreads2(ns: NS, target: string, maxThreads: number) {
    let n = 0;
    let { growThreads, weakenThreads } = calculateSowBatchThreads(ns, target, maxThreads);
    while (growThreads + weakenThreads > maxThreads && growThreads > 0) {
        n++;
        growThreads -= Math.ceil(weakenThreads / 3);
        ({ weakenThreads } = calculateSowBatchThreads(ns, target, growThreads));
    }
    return { n, growThreads, weakenThreads };
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
    return { n, ...calculateSowBatchThreads(ns, target, low) };
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

function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function std(values: number[]): number {
    if (values.length === 0) return 0;
    const m = mean(values);
    const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}
