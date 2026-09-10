import { describe, expect, it } from "vitest";
import type { AppId } from "../types";
import {
  getTaskbarAppForNumberKey,
  getTaskbarAppOrder,
  getTaskbarNumberAction,
  getTaskbarNumberKey,
} from "./taskbarOrder";

const available: AppId[] = ["files", "notepad", "paint", "terminal", "photos"];

describe("getTaskbarAppOrder", () => {
  it("lists the pinned apps in the order they were pinned", () => {
    expect(getTaskbarAppOrder(["notepad", "files"], available, [])).toEqual([
      "notepad",
      "files",
    ]);
  });

  it("adds an unpinned app that has a window, after the pinned ones", () => {
    expect(getTaskbarAppOrder(["files"], available, ["paint"])).toEqual(["files", "paint"]);
  });

  it("gives one button to an app with several windows", () => {
    expect(getTaskbarAppOrder([], available, ["paint", "paint", "terminal"])).toEqual([
      "paint",
      "terminal",
    ]);
  });

  it("does not list a pinned app twice when it also has a window", () => {
    expect(getTaskbarAppOrder(["files"], available, ["files"])).toEqual(["files"]);
  });

  it("drops a pin for an app this build does not have", () => {
    expect(getTaskbarAppOrder(["files", "ghost" as AppId], available, [])).toEqual(["files"]);
  });
});

describe("getTaskbarNumberKey", () => {
  it("reads the digit off the physical key", () => {
    expect(getTaskbarNumberKey({ code: "Digit3", key: "3" })).toBe(3);
    expect(getTaskbarNumberKey({ code: "Numpad7", key: "7" })).toBe(7);
  });

  it("still reads it with Shift held, where the key reports a symbol", () => {
    expect(getTaskbarNumberKey({ code: "Digit1", key: "!" })).toBe(1);
  });

  it("falls back to the key when there is no code", () => {
    expect(getTaskbarNumberKey({ key: "2" })).toBe(2);
  });

  it("takes nothing but 1 through 9", () => {
    expect(getTaskbarNumberKey({ code: "Digit0", key: "0" })).toBeNull();
    expect(getTaskbarNumberKey({ code: "KeyA", key: "a" })).toBeNull();
  });
});

describe("getTaskbarAppForNumberKey", () => {
  const order: AppId[] = ["files", "notepad", "paint"];
  const press = (key: string, code = `Digit${key}`) => ({ code, key });

  it("counts the buttons from the left", () => {
    expect(getTaskbarAppForNumberKey(order, press("1"))).toBe("files");
    expect(getTaskbarAppForNumberKey(order, press("3"))).toBe("paint");
  });

  it("reports nothing past the last button", () => {
    expect(getTaskbarAppForNumberKey(order, press("4"))).toBeNull();
  });

  it("works with Shift held, for the new-window half", () => {
    expect(getTaskbarAppForNumberKey(order, { code: "Digit2", key: "@" })).toBe("notepad");
  });

  it("takes no key but 1 through 9", () => {
    expect(getTaskbarAppForNumberKey(order, press("0", "Digit0"))).toBeNull();
    expect(getTaskbarAppForNumberKey(order, { code: "KeyA", key: "a" })).toBeNull();
  });
});

describe("getTaskbarNumberAction", () => {
  it("launches an app with no window", () => {
    expect(getTaskbarNumberAction([], null)).toEqual({ kind: "launch" });
  });

  it("brings a window forward when another app is in front", () => {
    expect(getTaskbarNumberAction(["w1"], "other")).toEqual({ kind: "focus", windowId: "w1" });
  });

  it("sends its own single window to the taskbar when it is already in front", () => {
    expect(getTaskbarNumberAction(["w1"], "w1")).toEqual({ kind: "minimize", windowId: "w1" });
  });

  it("walks along several windows instead of minimizing", () => {
    expect(getTaskbarNumberAction(["w1", "w2", "w3"], "w1")).toEqual({
      kind: "focus",
      windowId: "w2",
    });
    expect(getTaskbarNumberAction(["w1", "w2", "w3"], "w3")).toEqual({
      kind: "focus",
      windowId: "w1",
    });
  });
});
