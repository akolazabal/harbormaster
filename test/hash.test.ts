import { expect, test } from "vitest";
import { canonical, sha256Hex, recordHash, GENESIS_HASH } from "../src/shared/hash.js";

test("canonical sorts keys deterministically", () => {
  expect(canonical({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  expect(canonical({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
});

test("sha256Hex is stable and 64 hex chars", () => {
  const h = sha256Hex("hello");
  expect(h).toMatch(/^[0-9a-f]{64}$/);
  expect(h).toBe(sha256Hex("hello"));
});

test("recordHash chains off prevHash", () => {
  const h1 = recordHash(GENESIS_HASH, { seq: 0 });
  const h2 = recordHash(h1, { seq: 1 });
  expect(h1).not.toBe(h2);
  expect(h1).toMatch(/^[0-9a-f]{64}$/);
});
