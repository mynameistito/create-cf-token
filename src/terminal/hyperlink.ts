/**
 * OSC 8 terminal hyperlink helpers.
 *
 * @module terminal/hyperlink
 */

/**
 * Wrap a URL in an OSC 8 terminal hyperlink so it is clickable in supported terminals.
 * The visible text is the URL itself; the href target is also the full URL.
 *
 * @param url - The URL to link to and display.
 * @returns The URL wrapped in OSC 8 open/close sequences.
 */
export function hyperlinkUrl(url: string): string {
  return `\u001B]8;;${url}\u0007${url}\u001B]8;;\u0007`;
}
