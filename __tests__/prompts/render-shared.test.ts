import { describe, expect, test } from "bun:test";

import {
  appendBackHint,
  getGuidePrefix,
  isBackspaceKey,
  matchesSearch,
} from "#src/prompts/render/shared.ts";
import type { SearchOption } from "#src/prompts/types.ts";

const dnsReadOption: SearchOption = {
  fullScope: "com.cloudflare.api.account.zone",
  hint: "Read DNS records",
  label: "DNS Read",
  value: "dns-read",
};

describe("matchesSearch", () => {
  test("empty query matches any option", () => {
    expect(matchesSearch("", dnsReadOption)).toBe(true);
    expect(matchesSearch("   ", dnsReadOption)).toBe(true);
  });

  test("substring match on label and hint", () => {
    expect(matchesSearch("dns", dnsReadOption)).toBe(true);
    expect(matchesSearch("records", dnsReadOption)).toBe(true);
    expect(matchesSearch("account.zone", dnsReadOption)).toBe(true);
  });

  test("fuzzy subsequence match", () => {
    expect(matchesSearch("dr", dnsReadOption)).toBe(true);
    expect(matchesSearch("dnrdx", dnsReadOption)).toBe(false);
  });

  test("multi-term requires every term to match", () => {
    expect(matchesSearch("dns read", dnsReadOption)).toBe(true);
    expect(matchesSearch("dns write", dnsReadOption)).toBe(false);
    expect(matchesSearch("zone dns", dnsReadOption)).toBe(true);
  });
});

describe("isBackspaceKey", () => {
  test("detects key.name backspace", () => {
    expect(isBackspaceKey("", { name: "backspace" })).toBe(true);
  });

  test("detects DEL sequence", () => {
    expect(isBackspaceKey("", { sequence: "\u007F" })).toBe(true);
    expect(isBackspaceKey("\u007F", {})).toBe(true);
  });

  test("detects BS sequence", () => {
    expect(isBackspaceKey("", { sequence: "\b" })).toBe(true);
    expect(isBackspaceKey("\b", {})).toBe(true);
  });

  test("returns false for unrelated keys", () => {
    expect(isBackspaceKey("a", { name: "a" })).toBe(false);
    expect(isBackspaceKey("", {})).toBe(false);
  });
});

describe("getGuidePrefix", () => {
  test("returns empty string when guide is disabled", () => {
    expect(getGuidePrefix(false, "cyan")).toBe("");
    expect(getGuidePrefix(false, "yellow")).toBe("");
  });

  test("returns styled bar prefix when guide is enabled", () => {
    const cyanPrefix = getGuidePrefix(true, "cyan");
    const yellowPrefix = getGuidePrefix(true, "yellow");

    expect(cyanPrefix).not.toBe("");
    expect(yellowPrefix).not.toBe("");
    expect(cyanPrefix.endsWith("  ")).toBe(true);
    expect(yellowPrefix.endsWith("  ")).toBe(true);
  });
});

describe("appendBackHint", () => {
  test("appends back hint when allowBack is true", () => {
    const result = appendBackHint(["existing hint"], true);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe("existing hint");
    expect(result[1]).toContain("go back");
  });

  test("returns unchanged footer when allowBack is false", () => {
    const footer = ["existing hint"];

    expect(appendBackHint(footer, false)).toBe(footer);
    expect(footer).toEqual(["existing hint"]);
  });
});
