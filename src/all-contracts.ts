import { CodingContractObject } from '@ns';

export type ContractData = {
    file: string;
    host: string;
    type: string;
    data: CodingContractObject['data'];
    answer: Parameters<CodingContractObject['submit']> | string | null;
};

export const CONTRACTS: ContractData[] = [];
