import { importFromGlobal } from 'util/script-import';
const Immutable = await importFromGlobal('https://cdn.jsdelivr.net/npm/immutable@5.1.3/dist/immutable.min.js', 'Immutable', {
    integrity: 'sha256-0ssavT3GR0bFyMkMVJF4NAcvR0mnbuBQBYvGYwTfdEw=',
    crossOrigin: 'anonymous',
});
export const { Collection, List, Map, OrderedMap, OrderedSet, PairSorting, Range, Record, Repeat, Seq, Set, Stack, fromJS, get, getIn, has, hasIn, hash, is, isAssociative, isCollection, isImmutable, isIndexed, isKeyed, isList, isMap, isOrdered, isOrderedMap, isOrderedSet, isRecord, isSeq, isSet, isStack, isValueObject, merge, mergeDeep, mergeDeepWith, mergeWith, remove, removeIn, set, setIn, update, updateIn, } = Immutable;
