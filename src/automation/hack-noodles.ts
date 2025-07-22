import type { NS } from 'netscript';

export async function main(ns: NS) {
    const sing = ns.singularity;
    if (sing.isFocused()) {
        sing.setFocus(false);
    }
    sing.connect('home');
    sing.connect('n00dles');

    while (true) {
        await sing.manualHack();
    }
}
