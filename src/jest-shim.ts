declare global {
    interface Disposable {
        [Symbol.dispose](): void;
    }
    interface AsyncDisposable {
        [Symbol.asyncDispose](): Promise<void> | void;
    }
}
export {};
