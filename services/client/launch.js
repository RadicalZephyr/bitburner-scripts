import { isHostAllocation, TransferableAllocation, } from 'services/client/memory';
import { defineProtocol, BaseClient } from 'util/protocol';
import { isUnionOf, isArrayOf, isBoolean, isError, isLiteral, isNumber, isObjectLike, isOptional, isString, } from 'util/validate';
export const LAUNCH_PORT = 17;
export const LAUNCH_RESPONSE_PORT = 18;
export const MessageType = {
    Launch: 'Launch',
};
const isScriptArg = isUnionOf(isString, isNumber, isBoolean);
const isScriptArgArray = isArrayOf(isScriptArg);
const isAllocOptions = isObjectLike({
    contiguous: isOptional(isBoolean),
    coreDependent: isOptional(isBoolean),
    shrinkable: isOptional(isBoolean),
    longRunning: isOptional(isBoolean),
});
const isLaunchRunOptions = isObjectLike({
    alloc: isOptional(isAllocOptions),
    dependencies: isOptional(isArrayOf(isString)),
    threads: isOptional(isNumber),
    temporary: isOptional(isBoolean),
    ramOverride: isOptional(isNumber),
    preventDuplicates: isOptional(isBoolean),
});
const isLaunchRequest = isObjectLike({
    script: isString,
    options: isLaunchRunOptions,
    args: isScriptArgArray,
});
const isLaunchErrResponse = isObjectLike({
    ok: isLiteral(false),
    error: isError,
});
const isLaunchOkResponse = isObjectLike({
    ok: isLiteral(true),
    allocationId: isNumber,
    hosts: isArrayOf(isHostAllocation),
    pids: isArrayOf(isNumber),
});
const isLaunchResponse = isUnionOf(isLaunchOkResponse, isLaunchErrResponse);
export const LaunchProtocol = defineProtocol({
    [MessageType.Launch]: {
        payload: isLaunchRequest,
        response: isLaunchResponse,
    },
});
export class LaunchClient {
    #ns;
    #client;
    constructor(ns) {
        this.#ns = ns;
        this.#client = new BaseClient(LaunchProtocol, ns.getPortHandle(LAUNCH_PORT), ns.getPortHandle(LAUNCH_RESPONSE_PORT));
    }
    /**
     * Request launching a script via the launcher daemon.
     *
     * @param script  - Script to run
     * @param options - Launch options
     * @param args    - Arguments to pass to the script
     * @returns Allocation and pids or null on failure
     */
    async launch(script, options, ...args) {
        const payload = { script, options, args };
        const result = await this.#client.sendMessageReceiveResponse(MessageType.Launch, payload);
        if (!result.ok) {
            const errMessage = result.error.message;
            this.#ns.print(`ERROR: ${errMessage}`);
            return null;
        }
        const alloc = new TransferableAllocation(result.allocationId, result.hosts);
        return { allocation: alloc, pids: result.pids };
    }
}
