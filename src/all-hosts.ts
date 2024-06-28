import type { Server } from "netscript";

export type ServerInfo = {
    hostname: string,
    server: Server,
    reachableHosts: string[]
};

export type AllServerInfo = {
    [index: string]: ServerInfo
};

export const ALL_HOSTS: string[] = [];
export const ALL_SERVER_INFO: AllServerInfo = {};
export const HOSTS_BY_PORTS_REQUIRED: [string, number][][] = [[], [], [], [], [], []];
