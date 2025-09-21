import { isObjectUnknown } from 'util/validate';

/**
 * Get the key for the React prop object from an HTML Element.
 *
 * @remarks
 * Throws an error if no reactProps exists, likely because this
 * element was not created by React.
 *
 * @param el - HTML Element to find React props key on
 */
export function getReactPropKey(el: Element): string {
    const propKey = Object.keys(el).find((k) => k.startsWith('__reactProps'));
    if (!propKey) throw new Error(`no react prop key found on ${el.nodeName}`);
    if (!isObjectUnknown(el[propKey]))
        throw new Error(`React prop key holds an unexpected value`, {
            cause: el[propKey],
        });

    return propKey;
}

/**
 * Get the React props object from an HTML Element.
 *
 * @remarks
 * Throws an error if no reactProps exists, likely because this
 * element was not created by React.
 *
 * @param el - HTML Element to extract React props object from
 */
export function getReactProps(el: Element): Record<string, unknown> {
    const propKey = getReactPropKey(el);
    // NOTE: getReactPropKey verifies that this key definitely exists
    // and has the right shape
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return el[propKey];
}

/**
 * Bind a function key on an object as a callable function with the
 * object bound as `this`.
 *
 * @example
 * const props = { count: 0, inc() { this.count++; } };
 * const inc = bindPropFn(props, 'inc', 'missing inc');
 * inc();
 * props.count; // 1
 *
 * @param obj    - Prop object to access key on
 * @param key    - Function prop key to bind
 * @param msg  - Error message if the key does not exist or is not a function
 * @param args - Other arguments to bind to the function
 * @returns A function object with the given `this` and arguments bound
 */
export function bindPropFn<A extends unknown[]>(
    obj: Record<string, unknown>,
    key: string,
    msg: string,
    ...args: A
): (...args: unknown[]) => void {
    if (!Object.hasOwn(obj, key))
        throw new Error(`${msg}: Key ${String(key)} does not exist on object`);
    const fn = obj[key];
    if (typeof fn !== 'function')
        throw new Error(`${msg}: Key ${String(key)} is not a function`);

    return (fn as (...a: [...A, ...unknown[]]) => unknown).bind(
        obj,
        ...args,
    ) as (...args: unknown[]) => void;
}
