import { expect, test } from "bun:test";

import merge from "deepmerge";

interface AttackConfig {
  readonly __proto__?: { readonly isAdmin: boolean };
  readonly isAdmin?: boolean;
}

const payload: AttackConfig = JSON.parse('{"__proto__":{"isAdmin":true}}');

test("deepmerge does not poison a result from a null-prototype target", () => {
  const target: AttackConfig = Object.create(null);
  const result = merge(target, payload);
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(result.isAdmin).toBeUndefined();
});

test("copying a target with an own proto key cannot change the result prototype", () => {
  const result = merge(payload, {});
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(result.isAdmin).toBeUndefined();
});

test("nested null placeholders cannot acquire source-controlled prototypes", () => {
  const result = merge<{ profile: AttackConfig | null }>(
    { profile: null },
    { profile: payload }
  );
  expect(Object.getPrototypeOf(result.profile)).toBe(Object.prototype);
  expect(result.profile?.isAdmin).toBeUndefined();
});

test("ordinary nested configuration and array merging remain intact", () => {
  expect(
    merge(
      { list: [1], nested: { enabled: true } },
      { list: [2], nested: { count: 2 } }
    )
  ).toEqual({ list: [1, 2], nested: { count: 2, enabled: true } });
});
