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
