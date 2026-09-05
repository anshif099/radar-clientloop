import { expect, it } from "vitest";
import { parseByteRange } from "./byte-range";

it.each([
  ["bytes=0-9", { start: 0, end: 9 }],
  ["bytes=50-", { start: 50, end: 99 }],
  ["bytes=-10", { start: 90, end: 99 }],
  ["bytes=90-500", { start: 90, end: 99 }],
  ["bytes=-500", { start: 0, end: 99 }],
])("supports video seek request %s", (header, expected) => {
  expect(parseByteRange(header, 100)).toEqual(expected);
});

it.each(["bytes=100-", "bytes=9-1", "bytes=-0", "bytes=-", "bytes=0-1,4-5", "items=0-10", "bytes=999999999999999999999-", "bytes=0-NaN"])("rejects unsatisfiable or unsupported range %s", (header) => {
  expect(parseByteRange(header, 100)).toBeNull();
});
