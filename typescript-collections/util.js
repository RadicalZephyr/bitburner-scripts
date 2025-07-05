const _hasOwnProperty = Object.prototype.hasOwnProperty;
export const has = function (obj, prop) {
    return _hasOwnProperty.call(obj, prop);
};
/**
 * Default function to compare element order.
 * @function
 */
export function defaultCompare(a, b) {
    if (a < b) {
        return -1;
    }
    else if (a === b) {
        return 0;
    }
    else {
        return 1;
    }
}
/**
 * Default function to test equality.
 * @function
 */
export function defaultEquals(a, b) {
    return a === b;
}
/**
 * Default function to convert an object to a string.
 * @function
 */
export function defaultToString(item) {
    if (item === null) {
        return 'COLLECTION_NULL';
    }
    else if (isUndefined(item)) {
        return 'COLLECTION_UNDEFINED';
    }
    else if (isString(item)) {
        return '$s' + item;
    }
    else {
        return '$o' + item.toString();
    }
}
/**
 * Joins all the properies of the object using the provided join string
 */
export function makeString(item, join = ',') {
    if (item === null) {
        return 'COLLECTION_NULL';
    }
    else if (isUndefined(item)) {
        return 'COLLECTION_UNDEFINED';
    }
    else if (isString(item)) {
        return item.toString();
    }
    else {
        let toret = '{';
        let first = true;
        for (const prop in item) {
            if (has(item, prop)) {
                if (first) {
                    first = false;
                }
                else {
                    toret = toret + join;
                }
                toret = toret + prop + ':' + item[prop];
            }
        }
        return toret + '}';
    }
}
/**
 * Checks if the given argument is a function.
 * @function
 */
export function isFunction(func) {
    return (typeof func) === 'function';
}
/**
 * Checks if the given argument is undefined.
 * @function
 */
export function isUndefined(obj) {
    return (typeof obj) === 'undefined';
}
/**
 * Checks if the given argument is a string.
 * @function
 */
export function isString(obj) {
    return Object.prototype.toString.call(obj) === '[object String]';
}
/**
 * Reverses a compare function.
 * @function
 */
export function reverseCompareFunction(compareFunction) {
    if (isUndefined(compareFunction) || !isFunction(compareFunction)) {
        return function (a, b) {
            if (a < b) {
                return 1;
            }
            else if (a === b) {
                return 0;
            }
            else {
                return -1;
            }
        };
    }
    else {
        return function (d, v) {
            return compareFunction(d, v) * -1;
        };
    }
}
/**
 * Returns an equal function given a compare function.
 * @function
 */
export function compareToEquals(compareFunction) {
    return function (a, b) {
        return compareFunction(a, b) === 0;
    };
}
