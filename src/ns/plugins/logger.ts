import type { NS } from '@ns';

import { NsPlugin } from 'ns/extend';

import { RingBuffer } from 'util/ring-buffer';

export function loggerPlugin(bufferCap?: number) {
    const _bufferCap = bufferCap ?? 500;
    const buffer = new RingBuffer<string>(_bufferCap);

    function record(message: string) {
        while (buffer.size >= _bufferCap) {
            buffer.shift();
        }
        buffer.push(message);
    }

    return {
        name: 'logger',
        setup(ns: NS) {
            return {
                getLogBuffer(): RingBuffer<string> {
                    return buffer;
                },
                print(...args: unknown[]) {
                    record(argsToString(args));
                },
                printf(fmt: string, ...args: unknown[]) {
                    record(ns.vsprintf(fmt, args));
                },
                clearLog() {
                    buffer.clear();
                },
            };
        },
    } satisfies NsPlugin;
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
                    // eslint-disable-next-line @typescript-eslint/no-base-to-string
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

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return (out += String(arg));
    }, '');
}

function mapToString(map: Map<unknown, unknown>): string {
    const formattedMap = Array.from(map.entries())
        .map((m) => {
            return `${String(m[0])} => ${argsToString([m[1]])}`;
        })
        .join('; ');
    return `< Map: ${formattedMap} >`;
}

function setToString(set: Set<unknown>): string {
    return `< Set: ${[...set].map((el) => argsToString([el])).join('; ')} >`;
}
