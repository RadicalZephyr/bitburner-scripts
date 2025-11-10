/**
 * Ensure the provided value is a DOM Element, otherwise throw.
 *
 * @template {Element} T
 * @param {unknown} el
 * @param {string} msg
 * @param {(el: unknown) => el is T} guard
 * @returns {T}
 */
export function assertEl(el, msg, guard) {
    const g = guard ?? isElement;
    if (!(el != null && g(el)))
        throw new Error(msg);
    return el;
}
const isElement = (el) => {
    return el instanceof Element;
};
