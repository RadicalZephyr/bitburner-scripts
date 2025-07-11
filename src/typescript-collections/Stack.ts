import LinkedList from 'typescript-collections/LinkedList';
import * as util from 'typescript-collections/util';

export default class Stack<T> {
    /**
     * List containing the elements.
     * @type collections.LinkedList
     * @private
     */
    private list: LinkedList<T>;
    /**
     * Creates an empty Stack.
     * @class A Stack is a Last-In-First-Out (LIFO) data structure, the last
     * element added to the stack will be the first one to be removed. This
     * implementation uses a linked list as a container.
     * @constructor
     */
    constructor() {
        this.list = new LinkedList<T>();
    }

    /**
     * Pushes an item onto the top of this stack.
     * @param {Object} elem the element to be pushed onto this stack.
     * @return {boolean} true if the element was pushed or false if it is undefined.
     */
    push(elem: T) {
        return this.list.add(elem, 0);
    }
    /**
     * Pushes an item onto the top of this stack.
     * @param {Object} elem the element to be pushed onto this stack.
     * @return {boolean} true if the element was pushed or false if it is undefined.
     */
    add(elem: T) {
        return this.list.add(elem, 0);
    }
    /**
     * Removes the object at the top of this stack and returns that object.
     * @return {*} the object at the top of this stack or undefined if the
     * stack is empty.
     */
    pop(): T | undefined {
        return this.list.removeElementAtIndex(0);
    }
    /**
     * Looks at the object at the top of this stack without removing it from the
     * stack.
     * @return {*} the object at the top of this stack or undefined if the
     * stack is empty.
     */
    peek(): T | undefined {
        return this.list.first();
    }
    /**
     * Returns the number of elements in this stack.
     * @return {number} the number of elements in this stack.
     */
    size(): number {
        return this.list.size();
    }

    /**
     * Returns true if this stack contains the specified element.
     * <p>If the elements inside this stack are
     * not comparable with the === operator, a custom equals function should be
     * provided to perform searches, the function must receive two arguments and
     * return true if they are equal, false otherwise. Example:</p>
     *
     * <pre>
     * const petsAreEqualByName (pet1, pet2) {
     *  return pet1.name === pet2.name;
     * }
     * </pre>
     * @param {Object} elem element to search for.
     * @param {function(Object,Object):boolean=} equalsFunction optional
     * function to check if two elements are equal.
     * @return {boolean} true if this stack contains the specified element,
     * false otherwise.
     */
    contains(elem: T, equalsFunction?: util.IEqualsFunction<T>) {
        return this.list.contains(elem, equalsFunction);
    }
    /**
     * Checks if this stack is empty.
     * @return {boolean} true if and only if this stack contains no items; false
     * otherwise.
     */
    isEmpty(): boolean {
        return this.list.isEmpty();
    }
    /**
     * Removes all of the elements from this stack.
     */
    clear(): void {
        this.list.clear();
    }

    /**
     * Executes the provided function once for each element present in this stack in
     * LIFO order.
     * @param {function(Object):*} callback function to execute, it is
     * invoked with one argument: the element value, to break the iteration you can
     * optionally return false.
     */
    forEach(callback: util.ILoopFunction<T>) {
        this.list.forEach(callback);
    }
} // End of stack
