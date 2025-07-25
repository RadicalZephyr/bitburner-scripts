import * as util from 'typescript-collections/util';
import Heap from 'typescript-collections/Heap';

export default class PriorityQueue<T> {
    private heap: Heap<T>;
    /**
     * Creates an empty priority queue.
     * @class <p>In a priority queue each element is associated with a "priority",
     * elements are dequeued in highest-priority-first order (the elements with the
     * highest priority are dequeued first). Priority Queues are implemented as heaps.
     * If the inserted elements are custom objects a compare function must be provided,
     * otherwise the <=, === and >= operators are used to compare object priority.</p>
     * <pre>
     * function compare(a, b) {
     *  if (a is less than b by some ordering criterion) {
     *     return -1;
     *  } if (a is greater than b by the ordering criterion) {
     *     return 1;
     *  }
     *  // a must be equal to b
     *  return 0;
     * }
     * </pre>
     * @constructor
     * @param {function(Object,Object):number=} compareFunction optional
     * function used to compare two element priorities. Must return a negative integer,
     * zero, or a positive integer as the first argument is less than, equal to,
     * or greater than the second.
     */
    constructor(compareFunction?: util.ICompareFunction<T>) {
        this.heap = new Heap<T>(util.reverseCompareFunction(compareFunction));
    }

    /**
     * Inserts the specified element into this priority queue.
     * @param {Object} element the element to insert.
     * @return {boolean} true if the element was inserted, or false if it is undefined.
     */
    enqueue(element: T): boolean {
        return this.heap.add(element);
    }

    /**
     * Inserts the specified element into this priority queue.
     * @param {Object} element the element to insert.
     * @return {boolean} true if the element was inserted, or false if it is undefined.
     */
    add(element: T): boolean {
        return this.heap.add(element);
    }

    /**
     * Retrieves and removes the highest priority element of this queue.
     * @return {*} the the highest priority element of this queue,
     *  or undefined if this queue is empty.
     */
    dequeue(): T | undefined {
        if (this.heap.size() !== 0) {
            const el = this.heap.peek();
            this.heap.removeRoot();
            return el;
        }
        return undefined;
    }

    /**
     * Retrieves, but does not remove, the highest priority element of this queue.
     * @return {*} the highest priority element of this queue, or undefined if this queue is empty.
     */
    peek(): T | undefined {
        return this.heap.peek();
    }

    /**
     * Returns true if this priority queue contains the specified element.
     * @param {Object} element element to search for.
     * @return {boolean} true if this priority queue contains the specified element,
     * false otherwise.
     */
    contains(element: T): boolean {
        return this.heap.contains(element);
    }

    /**
     * Checks if this priority queue is empty.
     * @return {boolean} true if and only if this priority queue contains no items; false
     * otherwise.
     */
    isEmpty(): boolean {
        return this.heap.isEmpty();
    }

    /**
     * Returns the number of elements in this priority queue.
     * @return {number} the number of elements in this priority queue.
     */
    size(): number {
        return this.heap.size();
    }

    /**
     * Removes all of the elements from this priority queue.
     */
    clear(): void {
        this.heap.clear();
    }

    /**
     * Executes the provided function once for each element present in this queue in
     * no particular order.
     * @param {function(Object):*} callback function to execute, it is
     * invoked with one argument: the element value, to break the iteration you can
     * optionally return false.
     */
    forEach(callback: util.ILoopFunction<T>) {
        this.heap.forEach(callback);
    }
} // end of priority queue
