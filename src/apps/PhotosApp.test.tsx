// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PhotosApp from "./PhotosApp";
import type { DesktopItem } from "../types";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Pass `null` for an entry that exists but holds no image yet. */
function makeCanvas(id: string, name: string, content: string | null = PIXEL) {
  const item: DesktopItem = {
    content: content ?? undefined,
    createdAt: 1_700_000_000_000,
    id,
    kind: "canvas",
    name,
    parentId: "desktop",
    showOnDesktop: true,
    updatedAt: 1_700_000_000_000,
    x: 0,
    y: 0,
  };
  return item;
}

function renderPhotos(options: { activeCanvasId?: string; entries?: DesktopItem[] } = {}) {
  const handlers = {
    activateVfsEntry: vi.fn(),
    deleteVfsEntry: vi.fn(),
    notify: vi.fn(),
    openApp: vi.fn(),
    playSound: vi.fn(),
    renameVfsEntry: vi.fn(),
  };
  const entries = options.entries ?? [
    makeCanvas("photo-c", "c.png"),
    makeCanvas("photo-a", "a.png"),
    makeCanvas("photo-b", "b.png"),
  ];
  render(
    <PhotosApp
      activateVfsEntry={handlers.activateVfsEntry}
      activeCanvasId={options.activeCanvasId ?? "photo-b"}
      activeCanvasOpenKey={1}
      canvasEntries={entries}
      deleteVfsEntry={handlers.deleteVfsEntry}
      notify={handlers.notify}
      openApp={handlers.openApp}
      playSound={handlers.playSound}
      renameVfsEntry={handlers.renameVfsEntry}
      windowId="window-photos"
    />,
  );
  return { entries, handlers, user: userEvent.setup() };
}

function zoomLabel() {
  return within(screen.getByRole("group", { name: "확대/축소" })).getByText(/%$/).textContent;
}

beforeEach(() => {
  // PhotosApp measures its stage with a ResizeObserver; jsdom ships none.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {
        return undefined;
      }
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PhotosApp 선택", () => {
  it("activeCanvasId가 가리키는 사진을 연다", () => {
    renderPhotos({ activeCanvasId: "photo-b" });

    expect(screen.getByRole("img", { name: "b.png" })).toBeVisible();
    expect(screen.getByText("2 / 3")).toBeVisible();
  });

  it("activeCanvasId가 목록에 없으면 이름순 첫 사진으로 되돌아간다", () => {
    renderPhotos({ activeCanvasId: "photo-gone" });

    expect(screen.getByRole("img", { name: "a.png" })).toBeVisible();
    expect(screen.getByText("1 / 3")).toBeVisible();
  });
});

describe("PhotosApp 탐색", () => {
  it("다음 사진 버튼이 이름순으로 넘어가고 끝에서 처음으로 돈다", async () => {
    const { handlers, user } = renderPhotos({ activeCanvasId: "photo-b" });
    const next = screen.getByRole("button", { name: "다음 사진" });

    await user.click(next);
    expect(screen.getByRole("img", { name: "c.png" })).toBeVisible();
    expect(screen.getByText("3 / 3")).toBeVisible();

    await user.click(next);
    expect(screen.getByRole("img", { name: "a.png" })).toBeVisible();
    expect(screen.getByText("1 / 3")).toBeVisible();
    expect(handlers.playSound).toHaveBeenCalledWith("click");
  });

  it("이전 사진 버튼이 처음에서 끝으로 돈다", async () => {
    const { user } = renderPhotos({ activeCanvasId: "photo-a" });

    await user.click(screen.getByRole("button", { name: "이전 사진" }));

    expect(screen.getByRole("img", { name: "c.png" })).toBeVisible();
    expect(screen.getByText("3 / 3")).toBeVisible();
  });

  it("방향키로도 사진을 넘긴다", async () => {
    const { user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("img", { name: "c.png" })).toBeVisible();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("img", { name: "b.png" })).toBeVisible();
  });

  it("사진이 하나뿐이면 탐색 버튼을 잠근다", () => {
    renderPhotos({ activeCanvasId: "photo-a", entries: [makeCanvas("photo-a", "a.png")] });

    expect(screen.getByRole("button", { name: "이전 사진" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음 사진" })).toBeDisabled();
    expect(screen.getByText("1 / 1")).toBeVisible();
  });
});

describe("PhotosApp 확대/축소", () => {
  it("확대는 400%에서 멈추고 버튼을 잠근다", async () => {
    const { user } = renderPhotos();
    const zoomIn = screen.getByRole("button", { name: "확대" });

    expect(zoomLabel()).toBe("100%");

    await user.click(zoomIn);
    expect(zoomLabel()).toBe("125%");

    for (let step = 0; step < 20 && !(zoomIn as HTMLButtonElement).disabled; step += 1) {
      await user.click(zoomIn);
    }

    expect(zoomLabel()).toBe("400%");
    expect(zoomIn).toBeDisabled();
  });

  it("축소는 25%에서 멈추고 버튼을 잠근다", async () => {
    const { user } = renderPhotos();
    const zoomOut = screen.getByRole("button", { name: "축소" });

    await user.click(zoomOut);
    expect(zoomLabel()).toBe("80%");

    for (let step = 0; step < 20 && !(zoomOut as HTMLButtonElement).disabled; step += 1) {
      await user.click(zoomOut);
    }

    expect(zoomLabel()).toBe("25%");
    expect(zoomOut).toBeDisabled();
  });

  it("창에 맞춤이 직접 지정한 배율을 되돌린다", async () => {
    const { user } = renderPhotos();
    const fit = screen.getByRole("button", { name: "창에 맞춤" });

    await user.click(screen.getByRole("button", { name: "확대" }));
    expect(fit).toHaveAttribute("aria-pressed", "false");

    await user.click(fit);

    expect(zoomLabel()).toBe("100%");
    expect(fit).toHaveAttribute("aria-pressed", "true");
  });

  it("다른 사진으로 넘어가면 배율이 창에 맞춤으로 돌아간다", async () => {
    const { user } = renderPhotos();

    await user.click(screen.getByRole("button", { name: "확대" }));
    expect(zoomLabel()).toBe("125%");

    await user.click(screen.getByRole("button", { name: "다음 사진" }));

    expect(zoomLabel()).toBe("100%");
  });
});

describe("PhotosApp 이름 바꾸기", () => {
  it("이름 바꾸기가 현재 이름이 담긴 입력을 연다", async () => {
    const { user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.click(screen.getByRole("button", { name: "이름 바꾸기" }));

    const input = screen.getByRole("textbox", { name: "사진 이름" });
    expect(input).toHaveValue("b.png");
    expect(input).toHaveFocus();
  });

  // Committing with Enter blurs the input that is still mounted, so this also
  // guards the re-entry that used to rename and notify twice.
  it("새 이름을 넣으면 renameVfsEntry를 한 번만 호출한다", async () => {
    const { handlers, user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.click(screen.getByRole("button", { name: "이름 바꾸기" }));
    const input = screen.getByRole("textbox", { name: "사진 이름" });
    await user.clear(input);
    await user.type(input, "sunset.png{Enter}");

    expect(handlers.renameVfsEntry).toHaveBeenCalledWith("photo-b", "sunset.png");
    expect(handlers.renameVfsEntry).toHaveBeenCalledTimes(1);
    expect(handlers.notify).toHaveBeenCalledTimes(1);
    expect(handlers.playSound).toHaveBeenCalledWith("success");
    expect(screen.queryByRole("textbox", { name: "사진 이름" })).toBeNull();
  });

  it("입력에서 포커스가 빠지면 이름을 한 번만 바꾼다", async () => {
    const { handlers, user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.click(screen.getByRole("button", { name: "이름 바꾸기" }));
    const input = screen.getByRole("textbox", { name: "사진 이름" });
    await user.clear(input);
    await user.type(input, "sunset.png");
    await user.click(screen.getByRole("button", { name: "다음 사진" }));

    expect(handlers.renameVfsEntry).toHaveBeenCalledTimes(1);
    expect(handlers.renameVfsEntry).toHaveBeenCalledWith("photo-b", "sunset.png");
  });

  it("이름을 그대로 두고 확정하면 아무것도 바꾸지 않는다", async () => {
    const { handlers, user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.click(screen.getByRole("button", { name: "이름 바꾸기" }));
    await user.type(screen.getByRole("textbox", { name: "사진 이름" }), "{Enter}");

    expect(handlers.renameVfsEntry).not.toHaveBeenCalled();
    expect(handlers.notify).not.toHaveBeenCalled();
  });

  it("빈 이름은 거절하고 알림만 띄운다", async () => {
    const { handlers, user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.click(screen.getByRole("button", { name: "이름 바꾸기" }));
    const input = screen.getByRole("textbox", { name: "사진 이름" });
    await user.clear(input);
    await user.type(input, "   {Enter}");

    expect(handlers.renameVfsEntry).not.toHaveBeenCalled();
    expect(handlers.playSound).toHaveBeenCalledWith("error");
    expect(handlers.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "이름을 바꾸지 못했습니다" }),
    );
    // The rejection notice used to fire twice through the same blur re-entry.
    expect(handlers.notify).toHaveBeenCalledTimes(1);
  });

  it("Escape는 이름 바꾸기를 취소한다", async () => {
    const { handlers, user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.click(screen.getByRole("button", { name: "이름 바꾸기" }));
    const input = screen.getByRole("textbox", { name: "사진 이름" });
    await user.clear(input);
    await user.type(input, "sunset.png{Escape}");

    expect(handlers.renameVfsEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "사진 이름" })).toBeNull();
  });
});

describe("PhotosApp 삭제와 편집", () => {
  it("삭제가 현재 사진 id로 deleteVfsEntry를 호출한다", async () => {
    const { handlers, user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.click(screen.getByRole("button", { name: "삭제" }));

    expect(handlers.deleteVfsEntry).toHaveBeenCalledTimes(1);
    expect(handlers.deleteVfsEntry).toHaveBeenCalledWith("photo-b");
    expect(handlers.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "b.png을(를) 삭제했습니다" }),
    );
  });

  it("편집은 현재 사진을 활성화하고 그림판을 연다", async () => {
    const { entries, handlers, user } = renderPhotos({ activeCanvasId: "photo-b" });

    await user.click(screen.getByRole("button", { name: "편집" }));

    expect(handlers.activateVfsEntry).toHaveBeenCalledWith(
      entries.find((entry) => entry.id === "photo-b"),
    );
    expect(handlers.openApp).toHaveBeenCalledWith("paint");
  });
});

describe("PhotosApp 빈 상태", () => {
  it("사진이 없으면 안내와 잠긴 도구 모음을 보여 준다", () => {
    renderPhotos({ activeCanvasId: "", entries: [] });

    expect(screen.getByText("사진이 없습니다")).toBeVisible();
    expect(screen.getByText("0 / 0")).toBeVisible();
    expect(screen.getByText("선택한 사진 없음")).toBeVisible();
    expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "편집" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이름 바꾸기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "확대" })).toBeDisabled();
  });

  it("아직 그리지 않은 그림은 그림판으로 안내한다", async () => {
    const { handlers, user } = renderPhotos({
      activeCanvasId: "photo-empty",
      entries: [makeCanvas("photo-empty", "empty.png", null)],
    });

    expect(screen.getByText("아직 그리지 않은 그림입니다")).toBeVisible();
    expect(screen.queryByRole("img", { name: "empty.png" })).toBeNull();
    expect(screen.getByRole("button", { name: "축소" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "창에 맞춤" })).toBeDisabled();

    // The placeholder repeats the toolbar's 편집 action.
    const editButtons = screen.getAllByRole("button", { name: "편집" });
    expect(editButtons).toHaveLength(2);
    await user.click(editButtons[1]);

    expect(handlers.openApp).toHaveBeenCalledWith("paint");
  });
});
