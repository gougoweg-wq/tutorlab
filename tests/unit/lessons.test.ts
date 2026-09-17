import { describe, expect, it } from "vitest";
import { splitCount } from "@/modules/lessons/service";
describe("homework split", () => {
  it("10 across 3 topics → 4/3/3", () => expect(splitCount(10, 3)).toEqual([4, 3, 3]));
  it("keeps the total and handles edge cases", () => { expect(splitCount(7, 7)).toEqual([1, 1, 1, 1, 1, 1, 1]); expect(splitCount(3, 5)).toEqual([1, 1, 1, 0, 0]); expect(splitCount(5, 0)).toEqual([]); expect(splitCount(40, 8).reduce((a, b) => a + b)).toBe(40); });
});
