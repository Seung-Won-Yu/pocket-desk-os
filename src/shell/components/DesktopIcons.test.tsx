// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopItemIcon } from "./DesktopIcons";
import type { DesktopItem } from "../../types";

afterEach(cleanup);

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function makeItem(overrides: Partial<DesktopItem>): DesktopItem {
  return {
    createdAt: 0,
    id: "item",
    kind: "note",
    name: "메모.txt",
    parentId: "desktop",
    showOnDesktop: true,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function renderIcon(item: DesktopItem) {
  return render(
    <DesktopItemIcon
      draftName=""
      item={item}
      onCancelRename={vi.fn()}
      onChangeDraftName={vi.fn()}
      onCommitRename={vi.fn()}
      onContextMenu={vi.fn()}
      onMove={vi.fn()}
      onOpen={vi.fn()}
      onSelect={vi.fn()}
      renaming={false}
      selected={false}
      viewMode="medium"
    />,
  );
}

describe("desktop icon thumbnails", () => {
  it("a picture file with pixels shows those pixels instead of the generic tile", () => {
    renderIcon(makeItem({ content: PIXEL, id: "pic", kind: "canvas", name: "그림.canvas" }));
    const image = document.querySelector<HTMLImageElement>(".icon-thumbnail img");
    expect(image?.src).toBe(PIXEL);
  });

  it("an empty picture and a text file keep the tile", () => {
    renderIcon(makeItem({ id: "blank", kind: "canvas", name: "빈.canvas" }));
    expect(document.querySelector(".icon-thumbnail")).toBeNull();
    cleanup();
    renderIcon(makeItem({ content: "hello", id: "note" }));
    expect(document.querySelector(".icon-thumbnail")).toBeNull();
  });
});
