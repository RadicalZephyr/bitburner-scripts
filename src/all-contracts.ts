import { CodingContractObject } from "netscript";

export type ContractData = {
    file: string,
    host: string,
    type: string,
    data: CodingContractObject["data"],
    answer: Parameters<CodingContractObject["submit"]> | string,
};

export const CONTRACTS: ContractData[] = [];
