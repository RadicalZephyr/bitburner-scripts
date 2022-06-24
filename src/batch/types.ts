export type BatchSpec = {
    host: string,
    script: string,
    threads: number,
    target: string
    delay: number,
};

export type HostSpec = {
    host: string,
    threads: number,
    cores: number
};

export type TargetSpec = {
    host: string,
    hackThreads: number,
    hackWeakenThreads: number,
    growThreads: number,
    growWeakenThreads: number,
};
