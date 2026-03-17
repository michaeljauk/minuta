import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges multiple class name strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes (falsy values are dropped)", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    expect(cn("foo", undefined, "baz")).toBe("foo baz");
  });

  it("resolves Tailwind conflicts by keeping the last value", () => {
    // tailwind-merge: p-2 wins over p-4 when p-4 comes first
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles object syntax from clsx", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });

  it("returns an empty string when given no truthy values", () => {
    expect(cn(false, undefined, null as unknown as string)).toBe("");
  });
});
