export interface ServerNS {
    atExit(f: () => void, id?: string): void;
}
