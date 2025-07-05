/** Efficiently extend `array` with the given `values`. */
export function extend(array, values) {
    var l2 = values.length;
    if (l2 === 0)
        return array;
    var l1 = array.length;
    array.length += l2;
    for (var i = 0; i < l2; i++)
        array[l1 + i] = values[i];
    return array;
}
;
