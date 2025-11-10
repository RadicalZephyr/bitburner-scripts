import { parseFlags } from 'util/flags';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return data.servers;
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    const targets = flags._.filter((t) => typeof t === 'string');
    if (targets.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} TARGET [...TARGETS]

Benchmark sow thread allocation algorithms on TARGETS.

OPTIONS
  --help   Show this help message
`);
        return;
    }
    ns.disableLog('ALL');
    const maxThreadsList = [
        8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384,
    ];
    const algos = [
        [calculateSowThreadsForMaxThreads1, 'v1'],
        [calculateSowThreadsForMaxThreads2, 'v2'],
        [calculateSowThreadsForMaxThreads3, 'v3'],
    ];
    for (const target of targets) {
        if (!ns.serverExists(target)) {
            ns.print(`WARN: target ${target} does not exist`);
            continue;
        }
        ns.print(`INFO: benchmarking ${target}`);
        for (const [fn, name] of algos) {
            const results = benchmark(ns, fn, name, target, maxThreadsList);
            const iters = results.map((r) => r.iterations);
            const wastes = results.map((r) => r.maxThreads - r.usedThreads);
            const iterMean = mean(iters);
            const iterMed = median(iters);
            const wasteMean = mean(wastes);
            const wasteStd = std(wastes);
            ns.print(`INFO: ${target} ${name} μ=${ns.formatNumber(iterMean)} `
                + `median=${ns.formatNumber(iterMed)} `
                + `Δ=${ns.formatNumber(wasteMean)} σ=${ns.formatNumber(wasteStd)}`);
            await ns.sleep(10);
        }
    }
}
function benchmark(ns, fn, name, target, maxThreadsList) {
    const results = [];
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
function calculateSowThreadsForMaxThreads1(ns, target, maxThreads) {
    let n = 0;
    let { growThreads, weakenThreads } = calculateSowBatchThreads(ns, target, maxThreads);
    while (growThreads + weakenThreads > maxThreads && growThreads > 0) {
        n++;
        growThreads--;
        ({ weakenThreads } = calculateSowBatchThreads(ns, target, growThreads));
    }
    return { n, growThreads, weakenThreads };
}
function calculateSowThreadsForMaxThreads2(ns, target, maxThreads) {
    let n = 0;
    let { growThreads, weakenThreads } = calculateSowBatchThreads(ns, target, maxThreads);
    while (growThreads + weakenThreads > maxThreads && growThreads > 0) {
        n++;
        growThreads -= Math.ceil(weakenThreads / 3);
        ({ weakenThreads } = calculateSowBatchThreads(ns, target, growThreads));
    }
    return { n, growThreads, weakenThreads };
}
function calculateSowThreadsForMaxThreads3(ns, target, maxThreads) {
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
        }
        else if (growThreads + weakenThreads < maxThreads) {
            low = mid;
        }
        else {
            high = mid;
        }
    }
    return { n, ...calculateSowBatchThreads(ns, target, low) };
}
function calculateSowBatchThreads(ns, target, growThreads) {
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}
function weakenAnalyze(weakenAmount) {
    if (weakenAmount <= 0)
        return 0;
    return Math.ceil(weakenAmount * 20) + 1;
}
function mean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
}
function median(values) {
    if (values.length === 0)
        return 0;
    if (values.length === 1)
        return values[0];
    if (values.length === 2)
        return (values[0] + values[1]) / 2;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}
function std(values) {
    if (values.length === 0)
        return 0;
    const m = mean(values);
    const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}
