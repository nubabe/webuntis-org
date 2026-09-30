import { describe, expect, it, vi } from "vitest";
import { ensureOrgIds, type OrgIdRegistry } from "./org-id-registry";

const stubGenerator = (ids: ReadonlyArray<string>) => vi.fn((count: number) => ids.slice(0, count));

describe("ensureOrgIds", () => {
  it("returns the registry unchanged and never calls generateIds when nothing is missing", () => {
    const registry: OrgIdRegistry = { a: "id-a" };
    const generate = stubGenerator(["should-not-be-used"]);
    const result = ensureOrgIds(["a"], registry, generate);
    expect(result).toEqual({ registry, addedCount: 0 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("assigns new ids only for missing keys, preserving existing entries", () => {
    const registry: OrgIdRegistry = { a: "id-a" };
    const generate = stubGenerator(["id-b"]);
    const result = ensureOrgIds(["a", "b"], registry, generate);
    expect(result.registry).toEqual({ a: "id-a", b: "id-b" });
    expect(result.addedCount).toBe(1);
  });

  it("calls generateIds with exactly the count of missing keys", () => {
    const generate = stubGenerator(["id-a", "id-b", "id-c"]);
    ensureOrgIds(["a", "b", "c"], {}, generate);
    expect(generate).toHaveBeenCalledWith(3);
  });

  it("assigns generated ids to missing keys in order", () => {
    const generate = stubGenerator(["id-x", "id-y"]);
    const result = ensureOrgIds(["x", "y"], {}, generate);
    expect(result.registry).toEqual({ x: "id-x", y: "id-y" });
  });
});
