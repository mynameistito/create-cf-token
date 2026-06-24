import { describe, expect, test } from "bun:test";

import { hyperlinkUrl } from "#src/terminal/hyperlink.ts";

describe("hyperlinkUrl", () => {
  test("wraps URL in OSC 8 sequence", () => {
    const url = "https://dash.cloudflare.com/profile/api-tokens";
    const linked = hyperlinkUrl(url);

    expect(linked).toBe(`\u001B]8;;${url}\u0007${url}\u001B]8;;\u0007`);
    expect(linked.startsWith("\u001B]8;;")).toBe(true);
    expect(linked.endsWith("\u001B]8;;\u0007")).toBe(true);
    expect(linked).toContain(url);
  });
});
