// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Taskbar, TaskbarPreview } from "./Taskbar";
import { appCatalog } from "../appCatalog";
import type { WindowInstance } from "../types";
import type { AppId, DesktopItem } from "../../types";

type TaskbarProps = ComponentProps<typeof Taskbar>;

function makeWindow(id: string, appId: AppId, overrides: Partial<WindowInstance> = {}) {
  const instance: WindowInstance = {
    appId,
    desktopIndex: 0,
    height: 480,
    id,
    maximized: false,
    minimized: false,
    width: 640,
    x: 40,
    y: 40,
    z: 1,
    ...overrides,
  };
  return instance;
}

function makeHandlers() {
  return {
    onClearNotifications: vi.fn(),
    getDocumentLabel: vi.fn(() => undefined) as (appId: AppId) => string | undefined,
    onOpenApp: vi.fn(),
    onOpenNewWindow: vi.fn(),
    onOpenRunDialog: vi.fn(),
    onOpenStart: vi.fn(),
    onSearch: vi.fn(),
    onSetBrightness: vi.fn(),
    onSetSoundEnabled: vi.fn(),
    onSetVolume: vi.fn(),
    onShowDesktop: vi.fn(),
    onTogglePinnedApp: vi.fn(),
    onToggleTaskView: vi.fn(),
    onCloseWindow: vi.fn(),
    onOpenRecentDocument: vi.fn(),
    onToggleWindow: vi.fn(),
  };
}

function makeProps(
  handlers: ReturnType<typeof makeHandlers>,
  overrides: Partial<TaskbarProps> = {},
) {
  const props: TaskbarProps = {
    activeDesktopIndex: 0,
    availableApps: appCatalog,
    recentDocumentsByApp: new Map(),
    brightness: 100,
    clock24h: true,
    desktopCount: 1,
    notificationHistory: [],
    pinnedAppIds: ["browser", "files"],
    searchQuery: "",
    soundEnabled: true,
    volume: 72,
    startOpen: false,
    taskViewOpen: false,
    windows: [],
    ...handlers,
    ...overrides,
  };
  return props;
}

function renderTaskbar(overrides: Partial<TaskbarProps> = {}) {
  const handlers = makeHandlers();
  const props = makeProps(handlers, overrides);
  const view = render(<Taskbar {...props} />);
  return { handlers, props, user: userEvent.setup(), view };
}

/** The real shell owns the query; this mirrors that so typing accumulates. */
function ControlledSearchTaskbar(props: TaskbarProps) {
  const [query, setQuery] = useState(props.searchQuery);
  return (
    <Taskbar
      {...props}
      onSearch={(next) => {
        setQuery(next);
        props.onSearch(next);
      }}
      searchQuery={query}
    />
  );
}

function searchBox() {
  return screen.getByRole("searchbox", { name: "검색" });
}

function taskbarBackground() {
  return screen.getByRole("contentinfo");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Taskbar 검색", () => {
  it("입력한 글자를 onSearch로 넘긴다", async () => {
    const handlers = makeHandlers();
    const user = userEvent.setup();
    render(<ControlledSearchTaskbar {...makeProps(handlers)} />);

    await user.type(searchBox(), "note");

    expect(handlers.onSearch).toHaveBeenNthCalledWith(1, "n");
    expect(handlers.onSearch).toHaveBeenNthCalledWith(2, "no");
    expect(handlers.onSearch).toHaveBeenLastCalledWith("note");
    expect(searchBox()).toHaveValue("note");
  });

  it("포커스만으로는 검색을 시작하지 않는다", async () => {
    // Focusing used to fire onSearch, which opened the Start menu and pulled
    // focus away the moment Tab reached the field.
    const { handlers, user } = renderTaskbar({ searchQuery: "메모" });

    expect(searchBox()).toHaveValue("메모");
    await user.click(searchBox());

    expect(handlers.onSearch).not.toHaveBeenCalled();
  });
});

describe("Taskbar 작업 보기", () => {
  it("작업 보기 버튼이 onToggleTaskView를 호출한다", async () => {
    const { handlers, user } = renderTaskbar();

    const button = screen.getByRole("button", { name: "작업 보기 (데스크톱 1/1)" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    expect(handlers.onToggleTaskView).toHaveBeenCalledTimes(1);
  });

  it("데스크톱이 하나면 번호 배지를 숨긴다", () => {
    renderTaskbar({ activeDesktopIndex: 0, desktopCount: 1 });

    const button = screen.getByRole("button", { name: "작업 보기 (데스크톱 1/1)" });
    expect(button).toBeVisible();
    expect(button.textContent).toBe("");
  });

  it("데스크톱이 여러 개면 현재 번호를 보여 준다", () => {
    renderTaskbar({ activeDesktopIndex: 1, desktopCount: 3, taskViewOpen: true });

    const button = screen.getByRole("button", { name: "작업 보기 (데스크톱 2/3)" });
    expect(button.textContent).toBe("2");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Taskbar 앱 버튼", () => {
  it("고정된 앱과 창이 열린 앱을 모두 보여 준다", () => {
    renderTaskbar({
      pinnedAppIds: ["browser", "files"],
      windows: [makeWindow("win-notepad", "notepad")],
    });

    expect(screen.getByRole("button", { name: "Microsoft Edge" })).toBeVisible();
    expect(screen.getByRole("button", { name: "파일 탐색기" })).toBeVisible();
    expect(screen.getByRole("button", { name: "메모장" })).toBeVisible();
  });

  it("창이 없는 고정 앱을 누르면 앱을 연다", async () => {
    const { handlers, user } = renderTaskbar({ pinnedAppIds: ["browser"], windows: [] });

    await user.click(screen.getByRole("button", { name: "Microsoft Edge" }));

    expect(handlers.onOpenApp).toHaveBeenCalledWith("browser");
    expect(handlers.onToggleWindow).not.toHaveBeenCalled();
  });

  it("창이 열린 앱을 누르면 그 창을 토글한다", async () => {
    const { handlers, user } = renderTaskbar({
      pinnedAppIds: ["browser"],
      windows: [makeWindow("win-edge", "browser")],
    });

    await user.click(screen.getByRole("button", { name: "Microsoft Edge" }));

    expect(handlers.onToggleWindow).toHaveBeenCalledWith("win-edge");
    expect(handlers.onOpenApp).not.toHaveBeenCalled();
  });

  it("창이 여러 개면 개수를 함께 알린다", () => {
    renderTaskbar({
      pinnedAppIds: ["browser"],
      windows: [
        makeWindow("win-edge-1", "browser"),
        makeWindow("win-edge-2", "browser", { z: 2 }),
      ],
    });

    expect(screen.getByRole("button", { name: "Microsoft Edge, 2개 창" })).toBeVisible();
  });
});

describe("TaskbarPreview 포커스 유지", () => {
  it("카드 안으로 포커스가 들어오면 hover와 같은 유지 신호를 보낸다", () => {
    const onPointerEnter = vi.fn();
    const onPointerLeave = vi.fn();
    render(
      <TaskbarPreview
        app={appCatalog[0]}
        getDocumentLabel={() => undefined}
        left={100}
        onCloseWindow={vi.fn()}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onSelectWindow={vi.fn()}
        windows={[makeWindow("win-1", appCatalog[0].id)]}
      />,
    );

    // Tab이 카드 버튼에 닿는 순간 — 220ms 은닉 타이머가 취소돼야 한다.
    fireEvent.focus(screen.getAllByRole("button")[0]);
    expect(onPointerEnter).toHaveBeenCalled();
    fireEvent.blur(screen.getAllByRole("button")[0]);
    expect(onPointerLeave).toHaveBeenCalled();
  });
});

describe("Taskbar 점프 리스트", () => {
  function makeDocument(id: string, name: string): DesktopItem {
    return {
      createdAt: 0,
      id,
      kind: "note",
      name,
      parentId: "desktop",
      showOnDesktop: false,
      updatedAt: 0,
      x: 0,
      y: 0,
    };
  }

  it("우클릭 메뉴 맨 위에 최근 항목을 보여주고, 고르면 그 문서를 연다", async () => {
    const report = makeDocument("note-report", "보고서.txt");
    const memo = makeDocument("note-memo", "메모.txt");
    const { handlers, user } = renderTaskbar({
      pinnedAppIds: ["browser"],
      recentDocumentsByApp: new Map([["notepad", [report, memo]]]),
      windows: [makeWindow("win-notepad", "notepad")],
    });

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "메모장" }),
    });

    const items = screen.getAllByRole("menuitem");
    // 최근 두 항목이 앱 동작(새 창·고정·창 닫기)보다 먼저 온다.
    expect(items.slice(0, 2).map((item) => item.textContent)).toEqual([
      "보고서.txt",
      "메모.txt",
    ]);

    await user.click(screen.getByRole("menuitem", { name: "보고서.txt" }));
    expect(handlers.onOpenRecentDocument).toHaveBeenCalledWith(report);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("메뉴가 열리면 첫 최근 항목이 포커스를 받고 화살표·End로 전체를 돈다", async () => {
    // jsdom lays nothing out, so offsetParent — keyboardNav's reachability
    // probe — is always null there. Stand in the parent element for this test.
    const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() {
        return this.parentElement;
      },
    });
    try {
      await runJumpListKeyboardScenario();
    } finally {
      if (offsetParent) {
        Object.defineProperty(HTMLElement.prototype, "offsetParent", offsetParent);
      } else {
        delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
      }
    }
  });

  async function runJumpListKeyboardScenario() {
    const report = makeDocument("note-report", "보고서.txt");
    const { user } = renderTaskbar({
      pinnedAppIds: ["browser"],
      recentDocumentsByApp: new Map([["notepad", [report]]]),
      windows: [makeWindow("win-notepad", "notepad")],
    });

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "메모장" }),
    });

    // 최근 항목 1 + 고정 + 창 닫기.
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    await waitFor(() => expect(document.activeElement).toBe(items[0]));

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(items[2]);
  }

  it("최근 항목이 없는 앱 메뉴는 그대로다", async () => {
    const { user } = renderTaskbar({ pinnedAppIds: ["browser"] });

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "Microsoft Edge" }),
    });

    expect(screen.queryByText("최근 항목")).toBeNull();
  });
});

describe("Taskbar 앱 버튼 우클릭 메뉴", () => {
  it("고정된 앱은 고정 해제 항목만 열고 셸 메뉴는 열지 않는다", async () => {
    const { handlers, user } = renderTaskbar({ pinnedAppIds: ["browser", "files"] });

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "Microsoft Edge" }),
    });

    // Edge is single-instance, so its jump list is the pin toggle alone — and
    // nothing from the taskbar's shell menu.
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.queryByRole("menuitem", { name: /작업 관리자/ })).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "작업 표시줄에서 제거" }));

    expect(handlers.onTogglePinnedApp).toHaveBeenCalledTimes(1);
    expect(handlers.onTogglePinnedApp).toHaveBeenCalledWith("browser");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("고정되지 않은 앱은 고정 항목을 연다", async () => {
    const { handlers, user } = renderTaskbar({
      pinnedAppIds: ["browser"],
      windows: [makeWindow("win-notepad", "notepad")],
    });

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "메모장" }),
    });

    await user.click(screen.getByRole("menuitem", { name: "작업 표시줄에 고정" }));

    expect(handlers.onTogglePinnedApp).toHaveBeenCalledWith("notepad");
  });

  it("Escape로 우클릭 메뉴를 닫는다", async () => {
    const { handlers, user } = renderTaskbar({ pinnedAppIds: ["browser"] });

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "Microsoft Edge" }),
    });
    expect(screen.getByRole("menu")).toBeVisible();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(handlers.onTogglePinnedApp).not.toHaveBeenCalled();
  });
});

describe("Taskbar 배경 우클릭 셸 메뉴", () => {
  it("작업표시줄 배경을 우클릭하면 셸 메뉴가 열린다", async () => {
    const { user } = renderTaskbar();

    await user.pointer({ keys: "[MouseRight]", target: taskbarBackground() });

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "작업 관리자",
      "명령 프롬프트",
      "파일 탐색기",
      "실행",
      "설정",
      "바탕 화면 보기",
    ]);
  });

  it.each([
    ["작업 관리자", "onOpenApp", "taskmanager"],
    ["명령 프롬프트", "onOpenApp", "terminal"],
    ["파일 탐색기", "onOpenApp", "files"],
    ["설정", "onOpenApp", "settings"],
  ] as const)("%s 항목이 %s(%s)를 호출한다", async (label, _handler, appId) => {
    const { handlers, user } = renderTaskbar();

    await user.pointer({ keys: "[MouseRight]", target: taskbarBackground() });
    await user.click(screen.getByRole("menuitem", { name: label }));

    expect(handlers.onOpenApp).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenApp).toHaveBeenCalledWith(appId);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("실행 항목이 실행 대화 상자를 연다", async () => {
    const { handlers, user } = renderTaskbar();

    await user.pointer({ keys: "[MouseRight]", target: taskbarBackground() });
    await user.click(screen.getByRole("menuitem", { name: "실행" }));

    expect(handlers.onOpenRunDialog).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenApp).not.toHaveBeenCalled();
  });

  it("바탕 화면 보기 항목이 onShowDesktop을 호출한다", async () => {
    const { handlers, user } = renderTaskbar();

    await user.pointer({ keys: "[MouseRight]", target: taskbarBackground() });
    await user.click(screen.getByRole("menuitem", { name: "바탕 화면 보기" }));

    expect(handlers.onShowDesktop).toHaveBeenCalledTimes(1);
  });
});

describe("Taskbar 앱 메뉴 닫기", () => {
  it("실행 중인 앱의 창을 모두 닫는다", async () => {
    const { handlers, user } = renderTaskbar({
      pinnedAppIds: ["browser"],
      windows: [makeWindow("win-edge", "browser"), makeWindow("win-edge-2", "browser")],
    });

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "Microsoft Edge, 2개 창" }),
    });
    await user.click(screen.getByRole("menuitem", { name: "창 닫기" }));

    // Windows closes every window of the app from this menu, not just one.
    expect(handlers.onCloseWindow).toHaveBeenCalledWith("win-edge");
    expect(handlers.onCloseWindow).toHaveBeenCalledWith("win-edge-2");
    expect(handlers.onCloseWindow).toHaveBeenCalledTimes(2);
  });

  it("창이 없는 고정 앱에는 닫기를 보여주지 않는다", async () => {
    const { user } = renderTaskbar();

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "파일 탐색기" }),
    });

    expect(screen.queryByRole("menuitem", { name: "창 닫기" })).toBeNull();
  });
});

describe("Taskbar 새 창", () => {
  it("점프 목록에서 새 인스턴스를 연다", async () => {
    const { handlers, user } = renderTaskbar({
      pinnedAppIds: ["files"],
      windows: [makeWindow("win-files", "files")],
    });

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "파일 탐색기" }),
    });
    await user.click(screen.getByRole("menuitem", { name: "새 창" }));

    // Raising the running window would be the taskbar click; this must not.
    expect(handlers.onOpenNewWindow).toHaveBeenCalledWith("files");
    expect(handlers.onToggleWindow).not.toHaveBeenCalled();
  });

  it("가운데 클릭으로도 새 인스턴스를 연다", async () => {
    const { handlers, user } = renderTaskbar({
      pinnedAppIds: ["files"],
      windows: [makeWindow("win-files", "files")],
    });

    await user.pointer({
      keys: "[MouseMiddle]",
      target: screen.getByRole("button", { name: "파일 탐색기" }),
    });

    expect(handlers.onOpenNewWindow).toHaveBeenCalledWith("files");
  });

  it("우클릭은 새 창을 열지 않는다", async () => {
    const { handlers, user } = renderTaskbar({
      pinnedAppIds: ["files"],
      windows: [makeWindow("win-files", "files")],
    });

    // A right click fires auxclick too, so the button guard is what keeps the
    // context menu from opening a window every time it is summoned.
    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "파일 탐색기" }),
    });

    expect(handlers.onOpenNewWindow).not.toHaveBeenCalled();
  });

  it("문서 상태를 공유하는 앱에는 새 창을 제안하지 않는다", async () => {
    const { handlers, user } = renderTaskbar({
      pinnedAppIds: ["notepad"],
      windows: [makeWindow("win-notes", "notepad")],
    });

    // Two Notepad windows read one shell-level note id, so the autosave of one
    // overwrites the unsaved text of the other. The name is matched exactly:
    // hovering the button opens the preview card, whose own "메모장 전환"
    // button a /메모장/ regex also catches.
    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: "메모장" }),
    });
    expect(screen.queryByRole("menuitem", { name: "새 창" })).toBeNull();

    await user.keyboard("{Escape}");
    await user.pointer({
      keys: "[MouseMiddle]",
      target: screen.getByRole("button", { name: "메모장" }),
    });
    expect(handlers.onOpenNewWindow).not.toHaveBeenCalled();
  });
});
