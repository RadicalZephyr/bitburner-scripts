export type Validator<T> = (v: unknown) => v is T;

export type ProtocolDef = Record<
    string,
    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: Validator<any>;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response?: Validator<any>; // optional, cannot receive replies if missing
    }
>;
