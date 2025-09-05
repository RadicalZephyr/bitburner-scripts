import type { NS, ScriptArg, RunOptions } from 'netscript';

import type { AllocOptions, HostAllocation } from 'services/client/memory';
import {
    isHostAllocation,
    TransferableAllocation,
} from 'services/client/memory';

import { defineProtocol, BaseClient, AnyRequest } from 'util/protocol';
import {
    type Validator,
    isUnionOf,
    isArrayOf,
    isBoolean,
    isError,
    isLiteral,
    isNumber,
    isObjectLike,
    isOptional,
    isString,
} from 'util/validate';

export const LAUNCH_PORT = 17;
export const LAUNCH_RESPONSE_PORT = 18;

export const MessageType = {
    Launch: 'Launch',
} as const;

/**
 * Options for running a script remotely.
 *
 * alloc: Optional flags to request specific allocation strategies {@link AllocOptions}
 * dependencies:  Extra files to `scp` before execution
 */
export interface LaunchRunOptions extends RunOptions {
    alloc?: AllocOptions;
    dependencies?: string[];
}

export interface LaunchRequest {
    script: string;
    options: LaunchRunOptions;
    args: ScriptArg[];
}

export interface LaunchOkResponse {
    ok: true;
    allocationId: number;
    hosts: HostAllocation[];
    pids: number[];
}

export interface LaunchErrResponse {
    ok: false;
    error: Error;
}

export type LaunchResponse = LaunchOkResponse | LaunchErrResponse;

const isScriptArg: Validator<ScriptArg> = isUnionOf(
    isString,
    isNumber,
    isBoolean,
);

const isScriptArgArray: Validator<ScriptArg[]> = isArrayOf(isScriptArg);

const isAllocOptions: Validator<AllocOptions> = isObjectLike({
    contiguous: isOptional(isBoolean),
    coreDependent: isOptional(isBoolean),
    shrinkable: isOptional(isBoolean),
    longRunning: isOptional(isBoolean),
});

const isLaunchRunOptions: Validator<RunOptions> = isObjectLike({
    alloc: isOptional(isAllocOptions),
    dependencies: isOptional(isArrayOf(isString)),
    threads: isOptional(isNumber),
    temporary: isOptional(isBoolean),
    ramOverride: isOptional(isNumber),
    preventDuplicates: isOptional(isBoolean),
});

const isLaunchRequest: Validator<LaunchRequest> = isObjectLike({
    script: isString,
    options: isLaunchRunOptions,
    args: isScriptArgArray,
});

const isLaunchErrResponse: Validator<LaunchErrResponse> = isObjectLike({
    ok: isLiteral(false),
    error: isError,
});

const isLaunchOkResponse: Validator<LaunchOkResponse> = isObjectLike({
    ok: isLiteral(true),
    allocationId: isNumber,
    hosts: isArrayOf<HostAllocation>(isHostAllocation),
    pids: isArrayOf(isNumber),
});

const isLaunchResponse: Validator<LaunchResponse> = isUnionOf(
    isLaunchOkResponse,
    isLaunchErrResponse,
);

export const LaunchProtocol = defineProtocol({
    [MessageType.Launch]: {
        payload: isLaunchRequest,
        response: isLaunchResponse,
    },
});

export type LaunchProtocolDef = (typeof LaunchProtocol)['def'];

export type LaunchMessage = AnyRequest<LaunchProtocolDef>;

export class LaunchClient {
    #ns: NS;
    #client: BaseClient<LaunchProtocolDef>;

    constructor(ns: NS) {
        this.#ns = ns;
        this.#client = new BaseClient(
            LaunchProtocol,
            ns.getPortHandle(LAUNCH_PORT),
            ns.getPortHandle(LAUNCH_RESPONSE_PORT),
        );
    }

    /**
     * Request launching a script via the launcher daemon.
     *
     * @param script  - Script to run
     * @param options - Launch options
     * @param args    - Arguments to pass to the script
     * @returns Allocation and pids or null on failure
     */
    async launch(
        script: string,
        options: LaunchRunOptions,
        ...args: ScriptArg[]
    ): Promise<{ allocation: TransferableAllocation; pids: number[] }> {
        const payload: LaunchRequest = { script, options, args };
        const result = await this.#client.sendMessageReceiveResponse(
            MessageType.Launch,
            payload,
        );
        if (!result.ok) {
            const errMessage = (result as LaunchErrResponse).error.message;
            this.#ns.print(`ERROR: ${errMessage}`);
            return null;
        }
        const alloc = new TransferableAllocation(
            result.allocationId,
            result.hosts,
        );
        return { allocation: alloc, pids: result.pids };
    }
}
