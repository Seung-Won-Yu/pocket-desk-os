// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import NotepadApp from "./NotepadApp";
import type { DesktopItem } from "../types";

function makeNote(content: string): DesktopItem {
  return {
    content,
    createdAt: 1,
    id: "note-1",
    kind: "note",
    name: "notes.txt",
    parentId: "vfs-root",
    showOnDesktop: true,
    updatedAt: 1,
    x: 0,
    y: 0,
  };
}

function renderNotepad(content: string) {
  const note = makeNote(content);
  render(
    <NotepadApp
      activeNoteId={note.id}
      activateVfsEntry={vi.fn()}
      closeWindow={vi.fn()}
      createVfsFolder={vi.fn()}
      createVfsTextFile={vi.fn()}
      desktopItems={[note]}
      noteEntries={[note]}
      notify={vi.fn()}
      openVfsEntry={vi.fn()}
      registerCloseGuard={vi.fn()}
      saveNoteAs={vi.fn()}
      reportNoteTabs={vi.fn()}
      saveNoteContent={vi.fn()}
      windowId="win-notepad"
    />,
  );
  const editor = screen.getByLabelText("메모 내용") as HTMLTextAreaElement;
  return { editor, user: userEvent.setup() };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("메모장 Tab", () => {
  it("Shift+Tab은 선택한 텍스트를 남기고 들여쓰기만 지운다", async () => {
    // The first version spliced `before-the-tab + after-the-selection`,
    // deleting the selection itself with no undo and an autosave 850ms away.
    const { editor, user } = renderNotepad("\t중요한 문장");
    editor.focus();
    editor.setSelectionRange(1, 7);

    await user.keyboard("{Shift>}{Tab}{/Shift}");

    expect(editor.value).toBe("중요한 문장");
  });

  it("Shift+Tab으로 지운 들여쓰기는 실행 취소된다", async () => {
    const { editor, user } = renderNotepad("\t한 줄");
    editor.focus();
    editor.setSelectionRange(1, 1);

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(editor.value).toBe("한 줄");

    await user.keyboard("{Control>}z{/Control}");
    expect(editor.value).toBe("\t한 줄");
  });

  it("Tab은 선택을 탭 문자로 바꾸고 실행 취소된다", async () => {
    const { editor, user } = renderNotepad("가나다");
    editor.focus();
    editor.setSelectionRange(1, 2);

    await user.keyboard("{Tab}");
    expect(editor.value).toBe("가\t다");

    await user.keyboard("{Control>}z{/Control}");
    expect(editor.value).toBe("가나다");
  });
});

describe("메모장 탭", () => {
  const notes = ["a.txt", "b.txt", "c.txt"].map((name, index) => ({
    ...makeNote(`${name} 내용`),
    id: `note-${index}`,
    name,
  }));

  function renderTabs(activeNoteId: string) {
    localStorage.setItem("pocket-desk-notepad-tabs-v1", JSON.stringify(notes.map((n) => n.id)));
    const props = {
      activateVfsEntry: vi.fn(),
      closeWindow: vi.fn(),
      reportNoteTabs: vi.fn(),
      saveNoteContent: vi.fn(),
    };
    // The shell's side of it: activating a document puts it on screen.
    function Shell() {
      const [shown, setShown] = useState(activeNoteId);
      return (
        <NotepadApp
          activeNoteId={shown}
          activateVfsEntry={(item) => {
            props.activateVfsEntry(item);
            setShown(item.id);
          }}
          closeWindow={props.closeWindow}
          createVfsFolder={vi.fn()}
          createVfsTextFile={vi.fn()}
          desktopItems={notes}
          noteEntries={[
            ...notes,
            { ...makeNote("열지 않은 파일"), id: "never", name: "z.txt" },
          ]}
          notify={vi.fn()}
          openVfsEntry={vi.fn()}
          registerCloseGuard={vi.fn()}
          reportNoteTabs={props.reportNoteTabs}
          saveNoteAs={vi.fn()}
          saveNoteContent={props.saveNoteContent}
          windowId="win-notepad"
        />
      );
    }
    render(<Shell />);
    return { ...props, user: userEvent.setup() };
  }

  const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent);

  it("lists the documents that were opened, not every text file", () => {
    renderTabs("note-1");
    expect(tabNames()).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("closing the tab on screen shows its right-hand neighbour", async () => {
    const { activateVfsEntry, user } = renderTabs("note-1");
    await user.click(screen.getByRole("button", { name: "b.txt 탭 닫기" }));
    expect(tabNames()).toEqual(["a.txt", "c.txt"]);
    expect(activateVfsEntry).toHaveBeenLastCalledWith(notes[2]);
  });

  it("writes what was typed before its tab closes", async () => {
    const { saveNoteContent, user } = renderTabs("note-1");
    const editor = screen.getByLabelText("메모 내용");
    await user.type(editor, "!");
    await user.keyboard("{Control>}w{/Control}");
    expect(saveNoteContent).toHaveBeenCalledWith("note-1", "b.txt 내용!");
  });

  it("offers 다른 탭 닫기 and 오른쪽 탭 닫기 from a tab's menu", async () => {
    const { user } = renderTabs("note-0");
    fireEvent.contextMenu(screen.getByRole("tab", { name: /c\.txt/ }));
    const menu = screen.getByRole("menu", { name: "탭 메뉴" });
    expect(within(menu).getByRole("menuitem", { name: "오른쪽 탭 닫기" })).toBeDisabled();
    await user.click(within(menu).getByRole("menuitem", { name: "다른 탭 닫기" }));
    expect(tabNames()).toEqual(["c.txt"]);
  });

  it("moves the tab on screen along the strip with Ctrl+Shift+PageUp/PageDown", async () => {
    const { user } = renderTabs("note-0");
    await user.click(screen.getByLabelText("메모 내용"));
    await user.keyboard("{Control>}{Shift>}{PageDown}{/Shift}{/Control}");
    expect(tabNames()).toEqual(["b.txt", "a.txt", "c.txt"]);
    await user.keyboard("{Control>}{Shift>}{PageUp}{PageUp}{/Shift}{/Control}");
    expect(tabNames()).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("drops a dragged tab into the gap beside another", () => {
    renderTabs("note-0");
    const dataTransfer = { dropEffect: "", effectAllowed: "", setData: vi.fn() };
    const target = screen.getByRole("tab", { name: /c\.txt/ });
    fireEvent.dragStart(screen.getByRole("tab", { name: /a\.txt/ }), { dataTransfer });
    // jsdom lays nothing out: every box is 0 wide, so any x is its right half.
    fireEvent.dragOver(target, { clientX: 5, dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(tabNames()).toEqual(["b.txt", "c.txt", "a.txt"]);
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "application/x-pocketdesk-note-tab",
      "note-0",
    );
  });

  it("closes the window with its last tab", async () => {
    localStorage.clear();
    const { closeWindow, user } = renderTabs("note-0");
    fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.txt/ }));
    await user.click(screen.getByRole("menuitem", { name: "다른 탭 닫기" }));
    await user.click(screen.getByRole("button", { name: "a.txt 탭 닫기" }));
    expect(closeWindow).toHaveBeenCalledWith("win-notepad");
  });
});
