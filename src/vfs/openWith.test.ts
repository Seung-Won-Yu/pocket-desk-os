import { describe, expect, it } from "vitest";
import { type DesktopItem } from "../types";
import { canRememberOpenWith, getOpenWithChoices, getOpenWithExtensionLabel } from "./openWith";

const item = (name: string, kind: DesktopItem["kind"], content = ""): DesktopItem =>
  ({
    content,
    createdAt: 0,
    id: name,
    kind,
    name,
    parentId: "root",
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
  }) as DesktopItem;

describe("getOpenWithChoices", () => {
  it("offers a text file to 메모장 first and 명령 프롬프트 second", () => {
    expect(getOpenWithChoices(item("노트.txt", "note"), {})).toEqual([
      { appId: "notepad", isDefault: true },
      { appId: "terminal", isDefault: false },
    ]);
  });

  it("leads with whatever 기본 앱 says now", () => {
    expect(getOpenWithChoices(item("그림.png", "canvas"), { png: "paint" })).toEqual([
      { appId: "paint", isDefault: true },
      { appId: "photos", isDefault: false },
    ]);
  });

  it("offers a shortcut its one app", () => {
    expect(getOpenWithChoices(item("홈.url", "shortcut"), {})).toEqual([
      { appId: "browser", isDefault: true },
    ]);
  });

  it("has nothing to say about a folder", () => {
    expect(getOpenWithChoices(item("문서", "folder"), {})).toBeNull();
  });

  it("never lists an app twice", () => {
    const choices = getOpenWithChoices(item("노트.txt", "note"), { txt: "terminal" }) ?? [];
    expect(new Set(choices.map((choice) => choice.appId)).size).toBe(choices.length);
    expect(choices[0]).toEqual({ appId: "terminal", isDefault: true });
  });
});

describe("canRememberOpenWith", () => {
  it("knows which extensions 기본 앱 can change", () => {
    expect(canRememberOpenWith(item("노트.txt", "note"))).toBe(true);
    expect(canRememberOpenWith(item("묶음.zip", "zip" as DesktopItem["kind"]))).toBe(false);
  });
});

describe("getOpenWithExtensionLabel", () => {
  it("names the extension with its dot", () => {
    expect(getOpenWithExtensionLabel(item("그림.png", "canvas"))).toBe(".png");
  });
});
