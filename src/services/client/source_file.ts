import type { NS } from '@ns';

import { defineProtocol, BaseClient, AnyRequest } from 'util/protocol';
import {
    isLiteral,
    isNumber,
    isObjectLike,
    isRecordOf,
    Validator,
} from 'util/validate';

export const SOURCE_FILE_PORT = 19;
export const SOURCE_FILE_RESPONSE_PORT = 20;

export const MessageType = {
    RequestLevel: 'RequestLevel',
    RequestAll: 'RequestAll',
} as const;

export interface LevelRequest {
    n: number;
}

const isLevelRequest: Validator<LevelRequest> = isObjectLike({
    n: isNumber,
});

const AllSourceFilesRequest = 'SSF_AllSourceFiles';

const isAllSourceFilesRequest: Validator<typeof AllSourceFilesRequest> =
    isLiteral(AllSourceFilesRequest);

export type AllSourceFiles = Record<string, number>;

const isAllSourceFiles: Validator<AllSourceFiles> = isRecordOf(isNumber);

export const SourceFileProtocol = defineProtocol({
    [MessageType.RequestLevel]: {
        payload: isLevelRequest,
        response: isNumber,
    },
    [MessageType.RequestAll]: {
        payload: isAllSourceFilesRequest,
        response: isAllSourceFiles,
    },
});

export type SourceFileProtocolDef = (typeof SourceFileProtocol)['def'];

export type Message = AnyRequest<SourceFileProtocolDef>;

/** Client for the SourceFile service. */
export class SourceFileClient {
    #client: BaseClient<SourceFileProtocolDef>;

    constructor(ns: NS) {
        this.#client = new BaseClient(
            SourceFileProtocol,
            ns.getPortHandle(SOURCE_FILE_PORT),
            ns.getPortHandle(SOURCE_FILE_RESPONSE_PORT),
        );
    }

    /**
     * Query the level of a specific Source File.
     *
     * @param sf - Source File number
     * @returns Level of the Source File or 0 if not owned
     */
    getLevel(sf: number): Promise<number> {
        const payload: LevelRequest = { n: sf };
        return this.#client.sendMessageReceiveResponse(
            MessageType.RequestLevel,
            payload,
        );
    }

    /**
     * Retrieve all owned Source Files.
     *
     * @returns Mapping of Source File number to level
     */
    getAll(): Promise<AllSourceFiles> {
        return this.#client.sendMessageReceiveResponse(
            MessageType.RequestAll,
            AllSourceFilesRequest,
        );
    }
}

/**
 * Get the owned level of the given source file.
 *
 * @param ns - Netscript API instance
 * @param n  - Source file number to fetch
 * @returns The level of the given source file, zero if not owned.
 */
export async function getSourceFileLevel(ns: NS, n: number): Promise<number> {
    const client = new SourceFileClient(ns);
    return await client.getLevel(n);
}
