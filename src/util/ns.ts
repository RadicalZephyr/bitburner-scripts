export interface ServerNS {
    /**
     * Add a callback to be executed when the script dies.
     *
     * Each script can only register one callback per callback ID.
     * If another callback is registered with the same callback ID
     * the previous callback with that ID is forgotten and will not be executed when the script dies.
     *
     * @param f - A function to execute when the script dies.
     * @param id - Callback ID. Optional, defaults to `"default"`.
     */
    atExit(f: () => void, id?: string): void;

    /**
     * Prints one or more values or variables to the script’s logs.
     *
     * If the argument is a string, you can color code your message by prefixing your
     * string with one of these strings:
     *
     * - `"ERROR"`: The whole string will be printed in red. Use this prefix to indicate
     *   that an error has occurred.
     *
     * - `"SUCCESS"`: The whole string will be printed in green, similar to the default
     *   theme of the Terminal. Use this prefix to indicate that something is correct.
     *
     * - `"WARN"`: The whole string will be printed in yellow. Use this prefix to
     *   indicate that you or a user of your script should be careful of something.
     *
     * - `"INFO"`: The whole string will be printed in purplish blue. Use this prefix to
     *   remind yourself or a user of your script of something. Think of this prefix as
     *   indicating an FYI (for your information).
     *
     * For custom coloring, use ANSI escape sequences. The examples below use the Unicode
     * escape code `\u001b`. The color coding also works if `\u001b` is replaced with
     * the hexadecimal escape code `\x1b`. The Bash escape code `\e` is not supported.
     * The octal escape code `\033` is not allowed because the game runs JavaScript in
     * strict mode.
     *
     * @example
     * ```js
     * // Default color coding.
     * ns.print("ERROR means something's wrong.");
     * ns.print("SUCCESS means everything's OK.");
     * ns.print("WARN Tread with caution!");
     * ns.print("WARNING, warning, danger, danger!");
     * ns.print("WARNing! Here be dragons.");
     * ns.print("INFO for your I's only (FYI).");
     * ns.print("INFOrmation overload!");
     * // Custom color coding.
     * const cyan = "\u001b[36m";
     * const green = "\u001b[32m";
     * const red = "\u001b[31m";
     * const reset = "\u001b[0m";
     * ns.print(`${red}Ugh! What a mess.${reset}`);
     * ns.print(`${green}Well done!${reset}`);
     * ns.print(`${cyan}ERROR Should this be in red?${reset}`);
     * ns.tail();
     * ```
     *
     * @param args - Value(s) to be printed.
     */
    print(...args: unknown[]): void;
}
