/**
 * Send a command to the game terminal, simulating user input.
 */
export function sendTerminalCommand(command: string) {
    // Acquire a reference to the terminal text field
    const terminalInput = globalThis['terminal-input'];
    if (!(terminalInput instanceof HTMLInputElement)) return;

    terminalInput.value = command;

    // Get a reference to the React event handler.
    const handler = Object.keys(terminalInput)[1];

    // Perform an onChange event to set some internal values.
    terminalInput[handler].onChange({ target: terminalInput });

    // Simulate an enter press
    terminalInput[handler].onKeyDown({
        key: 'Enter',
        preventDefault: (): void => null,
    });
}
