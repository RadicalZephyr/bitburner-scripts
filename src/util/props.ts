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
    if (!propKey)
        throw new Error(`no react prop key found on ${el.toString()}`);

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
    return el[propKey];
}

/**
 * Bind a function key on an object as a callable function with the
 * object bound as `this`.
 *
 * @param v    - Prop object to access key on
 * @param k    - Prop key to bind
 * @param msg  - Error message if the key does not exist or is not a function
 * @param args - Other arguments to bind to the function
 * @returns A function object with the given `this` and arguments bound
 */
export function bindPropFn(
    v: Record<string, unknown>,
    k: string,
    msg: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (...args: any[]) => void {
    if (!Object.hasOwn(v, k))
        throw new Error(`${msg}: Key ${k} does not exist on object`);
    if (typeof v[k] !== 'function')
        throw new Error(`${msg}: Key ${k} is not a function`);

    return v[k].bind(v, ...args);
}
