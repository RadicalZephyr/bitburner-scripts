/** Efficiently extend `array` with the given `values`. */
export function extend<T>(array: T[], values: T[]): T[] {
    const l2 = values.length;

    if (l2 === 0)
        return array;

    const l1 = array.length;

    array.length += l2;

    for (let i = 0; i < l2; i++)
        array[l1 + i] = values[i];

    return array;
};
