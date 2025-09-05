# Implementing Protocol Clients and Servers

Follow these steps when creating new components using the `protocol` and `validate` utilities:

1. **Define message types**

    ```typescript
    export const MessageType = {
        Ping: 'ping',
        // add additional message types here
    } as const;
    ```

2. **Create validators for request and response payloads** using helpers from `src/util/validate.ts`.

    ```typescript
    import {
        isLiteral,
        isObjectLike,
        isString,
        type Validator,
    } from 'util/validate';

    // Requests with no data should use string constant with a relevant string
    const PingRequest = 'PingRequest';
    type PingRequest = typeof PingRequest;
    const isPingRequest: Validator<PingRequest> = isLiteral(PingRequest);

    interface PingResponse {
        message: string;
    }
    // Validator functions for `{{Type}}` should always be named `is{{Type}}`
    const isPingResponse: Validator<PingResponse> = isObjectLike({
        message: isString,
    });
    ```

3. **Define the protocol and its definition object type alias**

    ```typescript
    import { defineProtocol } from 'util/protocol';

    const PingProtocol = defineProtocol({
        [MessageType.ping]: {
            payload: validatePingRequest,
            response: validatePingResponse,
        },
    });
    export type PingProtocolDef = (typeof PingProtocol)['def'];
    ```

4. **Use a literal string constant for empty requests**—do not use `null` or `{}` as payloads with no data.

5. **Wrap `BaseClient` inside a client class** to hide raw sending methods.

    ```typescript
    import { BaseClient } from 'util/protocol';
    export class PingClient {
        #client: BaseClient<PingProtocolDef>;

        constructor(ns) {
            this.#client = new BaseClient<PingProtocolDef>(
                ns,
                ns.getPortHandle(PING_PORT),
                ns.getPortHandle(PING_RESPONSE_PORT),
            );
        }

        async ping(): Promise<PingResponse> {
            return this.#client.sendAndReceive(MessageType.ping, '');
        }
    }
    ```

6. **Extend `BaseServer` for the server implementation** and define the `Handlers` map inside the constructor.
    ```typescript
    import { BaseServer, type Handlers } from 'util/protocol';
    export class PingServer extends BaseServer<PingProtocolDef> {
        constructor(ns: NS) {
            const requestPort = ns.getPortHandle(PING_PORT);
            const responsePort = ns.getPortHandle(PING_RESPONSE_PORT);
            const handlers: Handlers<PingProtocolDef> = {
                [MessageType.ping]: async () => ({ message: 'pong' }),
            };
            super(ns, PingProtocol, requestPort, responsePort, handlers);
        }
    }
    ```
