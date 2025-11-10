import { parseFlags } from 'util/flags';
import { connectTo } from 'automation/connect';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return data.servers;
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    const rest = flags._;
    if (flags.help || rest.length > 1) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} [TARGET]

Start hacking

Example:
  > run ${ns.getScriptName()} hack.js

OPTIONS:
  TARGET  Host to hack
  --help  Show this help message

`);
        return;
    }
    const target = rest[0] ?? 'n00dles';
    const sing = ns.singularity;
    if (sing.isFocused()) {
        sing.setFocus(false);
    }
    sing.connect('home');
    await connectTo(ns, target);
    while (true) {
        await sing.manualHack();
    }
}
