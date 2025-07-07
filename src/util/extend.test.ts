import { extend } from "util/extend";

test('empty values array does not alter array', () => {
    const arr = [1, 2, 3];
    const result = extend(arr, []);
    expect(result).toBe(arr);
    expect(arr.length).toBe(3);
});

test('two empty arrays return original array', () => {
    const arr: number[] = [];
    const result = extend(arr, []);
    expect(result).toBe(arr);
    expect(arr.length).toBe(0);
});

test('appends values in order', () => {
    const arr = [1];
    const result = extend(arr, [2, 3]);
    expect(result).toBe(arr);
    expect(arr.length).toBe(3);
    expect(arr).toStrictEqual([1, 2, 3]);
});

test('empty array gets populated', () => {
    const arr: number[] = [];
    const result = extend(arr, [4, 5]);
    expect(result).toBe(arr);
    expect(arr).toStrictEqual([4, 5]);
});
