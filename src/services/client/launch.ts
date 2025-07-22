import type { NS, ScriptArg, RunOptions } from 'netscript';
import type { HostAllocation } from 'services/client/memory';
import { TransferableAllocation } from 'services/client/memory';
import { Client, Message as ClientMessage } from 'util/client';

export const LAUNCH_PORT = 17;
export const LAUNCH_RESPONSE_PORT = 18;

export enum MessageType {
    Launch,
}

/**
 * Options for launching a script through the Launch service.
 *
 * contiguous:    Request a single contiguous allocation if possible
 * coreDependent: Prefer hosts with more cores when allocating RAM
 * longRunning:   Avoid running long jobs on "home" if possible
 * dependencies:  Extra files to `scp` before execution
 * ramOverride:   Override the RAM usage passed to {@link NS.exec}
 */
export interface LaunchRunOptions extends RunOptions {
    contiguous?: boolean;
    coreDependent?: boolean;
    longRunning?: boolean;
    dependencies?: string[];
    ramOverride?: number;
}

export interface LaunchRequest {
    script: string;
    options: LaunchRunOptions;
    args: ScriptArg[];
}

export interface LaunchResponse {
    allocationId: number;
    hosts: HostAllocation[];
    pids: number[];
}

export type Message = ClientMessage<MessageType, LaunchRequest>;

export class LaunchClient extends Client<
    MessageType,
    LaunchRequest,
    LaunchResponse | null
> {
    constructor(ns: NS) {
        super(ns, LAUNCH_PORT, LAUNCH_RESPONSE_PORT);
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
    ): Promise<{ allocation: TransferableAllocation; pids: number[] } | null> {
        const payload: LaunchRequest = { script, options, args };
        const result = await this.sendMessageReceiveResponse(
            MessageType.Launch,
            payload,
        );
        if (!result) {
            return null;
        }
        const alloc = new TransferableAllocation(
            result.allocationId,
            result.hosts,
        );
        return { allocation: alloc, pids: result.pids };
    }
}
