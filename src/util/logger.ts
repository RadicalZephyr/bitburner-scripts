import type { NS } from '@ns';

import { RingBuffer } from 'util/ring-buffer';

type InstallOptions = {
    bufferCap?: number;
};

export function installLogger(
    ns: NS,
    opts: InstallOptions = {},
): { ns: NS; buffer: RingBuffer<string> } {
    const _bufferCap = opts.bufferCap ?? 500;
    const buffer = new RingBuffer<string>(_bufferCap);

    function record(message: string) {
        while (buffer.size >= _bufferCap) {
            buffer.shift();
        }
        buffer.push(message);
    }

    const print = (...args: unknown[]) => {
        record(argsToString(args));
    };
    const printf = (fmt: string, ...args: unknown[]) => {
        record(ns.vsprintf(fmt, args));
    };
    const clearLog = () => {
        buffer.clear();
    };

    const proxy = new Proxy(ns, {
        get(target, prop, recv) {
            switch (prop) {
                case 'print':
                    return print;
                case 'printf':
                    return printf;
                case 'clearLog':
                    return clearLog;
                default:
                    return Reflect.get(target, prop, recv);
            }
        },
    });

    return {
        ns: proxy as NS,
        buffer,
    };
}

function argsToString(args: unknown[]): string {
    // Reduce array of args into a single output string
    return args.reduce<string>((out: string, arg: unknown) => {
        if (arg === null) {
            return (out += 'null');
        }
        if (arg === undefined) {
            return (out += 'undefined');
        }

        // Handle Map formatting, since it does not JSON stringify or toString in a helpful way
        // output is  "< Map: key1 => value1; key2 => value2 >"
        if (arg instanceof Map) {
            return (out += mapToString(arg));
        }
        // Handle Set formatting, since it does not JSON stringify or toString in a helpful way
        if (arg instanceof Set) {
            return (out += setToString(arg));
        }
        if (typeof arg === 'object') {
            return (out += JSON.stringify(arg, (_, value: unknown) => {
                /**
                 * If the property is a promise, we will return a string that clearly states that it's a promise object, not a
                 * normal object. If we don't do that, all promises will be serialized into "{}".
                 */
                if (value instanceof Promise) {
                    return value.toString();
                }
                if (value instanceof Map) {
                    return mapToString(value);
                }
                if (value instanceof Set) {
                    return setToString(value);
                }
                return value;
            }));
        }

        return (out += String(arg));
    }, '');
}

function mapToString(map: Map<unknown, unknown>): string {
    const formattedMap = [...map]
        .map((m) => {
            return `${String(m[0])} => ${String(m[1])}`;
        })
        .join('; ');
    return `< Map: ${formattedMap} >`;
}

function setToString(set: Set<unknown>): string {
    return `< Set: ${[...set].join('; ')} >`;
}
