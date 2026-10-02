import { describe, expect, it } from "vitest";
import { getStartupLaunchIds, normalizeStartupApps, setStartupAppEnabled } from "./startupApps";

describe("setStartupAppEnabled", () => {
  it("adds an app once and keeps the apps' own order", () => {
    const once = setStartupAppEnabled([], "notepad", true);
    const twice = setStartupAppEnabled(once, "notepad", true);
    expect(twice).toEqual(["notepad"]);
    const both = setStartupAppEnabled(twice, "calculator", true);
    expect(both.indexOf("calculator")).toBeLessThan(both.indexOf("notepad"));
  });

  it("takes an app off the list", () => {
    expect(setStartupAppEnabled(["calculator", "notepad"], "notepad", false)).toEqual([
      "calculator",
    ]);
  });
});

describe("getStartupLaunchIds", () => {
  it("opens what is enabled and not already on screen", () => {
    expect(getStartupLaunchIds(["calculator", "notepad"], ["notepad"])).toEqual(["calculator"]);
  });

  it("opens nothing when nothing is enabled", () => {
    expect(getStartupLaunchIds([], ["notepad"])).toEqual([]);
  });
});

describe("normalizeStartupApps", () => {
  it("keeps real app ids, once each, in order", () => {
    expect(normalizeStartupApps(["notepad", "nope", "calculator", "notepad", 3])).toEqual([
      "calculator",
      "notepad",
    ]);
  });

  it("reads anything that is not a list as empty", () => {
    expect(normalizeStartupApps("notepad")).toEqual([]);
    expect(normalizeStartupApps(null)).toEqual([]);
  });
});
