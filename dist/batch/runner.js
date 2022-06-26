export async function main(ns) {
    const specJSON = ns.args[0];
    if (typeof specJSON != 'string') {
        ns.printf('invalid batch spec %s', specJSON);
        return;
    }
    const batchSpecs = JSON.parse(specJSON);
    for (const spec of batchSpecs) {
        ns.exec(spec.script, spec.host, spec.threads, spec.target, spec.delay);
    }
}
