import { RingBuffer } from 'util/ring-buffer';
export function loggerPlugin(bufferCap) {
    const _bufferCap = bufferCap ?? 500;
    const buffer = new RingBuffer(_bufferCap);
    function record(message) {
        while (buffer.size >= _bufferCap) {
            buffer.shift();
        }
        buffer.push(message);
    }
    return {
        name: 'logger',
        setup(ns) {
            return {
                getLogBuffer() {
                    return buffer;
                },
                print(...args) {
                    record(argsToString(args));
                },
                printf(fmt, ...args) {
                    record(ns.vsprintf(fmt, args));
                },
                clearLog() {
                    buffer.clear();
                },
            };
        },
    };
}
function argsToString(args) {
    // Reduce array of args into a single output string
    return args.reduce((out, arg) => {
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
            return (out += JSON.stringify(arg, (_, value) => {
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
function mapToString(map) {
    const formattedMap = Array.from(map.entries())
        .map((m) => {
        return `${String(m[0])} => ${argsToString([m[1]])}`;
    })
        .join('; ');
    return `< Map: ${formattedMap} >`;
}
function setToString(set) {
    return `< Set: ${[...set].map((el) => argsToString([el])).join('; ')} >`;
}
