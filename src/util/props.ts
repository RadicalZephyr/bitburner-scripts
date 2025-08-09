/**
 * Get the React props object from an HTML Element.
 *
 * @param el - HTML Element to extract React props object from
 */
export function getReactProps(el: Element): Record<string, unknown> | null {
    const propKey = Object.keys(el).find((k) => k.startsWith('__reactProps'));
    if (!propKey) return null;

    return el[propKey];
}
