export type GuardFn<T> = (el: unknown) => el is T;

export function assertEl(el: unknown, msg: string): Element;
export function assertEl<T extends Element>(
    el: unknown,
    msg: string,
    guard: GuardFn<T>,
): T;
/**
 * @template {Element} T
 * @param {unknown} el
 * @param {string} msg
 * @param {(el: unknown) => el is T} guard
 * @returns {T}
 */
export function assertEl<T extends Element>(
    el: unknown,
    msg: string,
    guard?: GuardFn<T>,
): T {
    const g = guard ?? (isElement as GuardFn<T>);
    if (!(el != null && g(el))) throw new Error(msg);
    return el;
}

const isElement: GuardFn<Element> = (el: unknown) => {
    return el instanceof Element;
};
