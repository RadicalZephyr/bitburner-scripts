export type HostInfo = {
    hostname: string,
    numOpenPortsRequired: number,
    maxRam: number,
    moneyMax: number,
    serverGrowth: number,
    // hackDifficulty: number, // This parameter can't be retrieved from a specific API call.
    minDifficulty: number,
    requiredHackingSkill: number,
    reachableHosts: string[],
};

export type AllHostInfo = {
    [index: string]: HostInfo
};

export const ALL_HOSTS: string[] = [];
export const ALL_SERVER_INFO: AllHostInfo = {};
export const HOSTS_BY_PORTS_REQUIRED: string[][] = [[], [], [], [], [], []];
export const TARGETS_BY_PORTS_REQUIRED: string[][] = [[], [], [], [], [], []];
