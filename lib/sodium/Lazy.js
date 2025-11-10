/**
 * A representation for a value that may not be available until the current
 * transaction is closed.
 */
export class Lazy {
    constructor(f) {
        this.f = f;
    }
    f;
    /**
     * Get the value if available, throwing an exception if not.
     * In the general case this should only be used in subsequent transactions to
     * when the Lazy was obtained.
     */
    get() {
        return this.f();
    }
    /**
     * Map the lazy value according to the specified function, so the returned Lazy reflects
     * the value of the function applied to the input Lazy's value.
     * @param f Function to apply to the contained value. It must be <em>referentially transparent</em>.
     */
    map(f) {
        return new Lazy(() => {
            return f(this.f());
        });
    }
    /**
     * Lift a binary function into lazy values, so the returned Lazy reflects
     * the value of the function applied to the input Lazys' values.
     */
    lift(b, f) {
        return new Lazy(() => {
            return f(this.f(), b.f());
        });
    }
    /**
     * Lift a ternary function into lazy values, so the returned Lazy reflects
     * the value of the function applied to the input Lazys' values.
     */
    lift3(b, c, f) {
        return new Lazy(() => {
            return f(this.f(), b.f(), c.f());
        });
    }
    /**
     * Lift a quaternary function into lazy values, so the returned Lazy reflects
     * the value of the function applied to the input Lazys' values.
     */
    lift4(b, c, d, f) {
        return new Lazy(() => {
            return f(this.f(), b.f(), c.f(), d.f());
        });
    }
}
