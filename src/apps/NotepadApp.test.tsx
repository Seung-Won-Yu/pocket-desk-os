// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
      saveNoteContent={vi.fn()}
      windowId="win-notepad"
    />,
  );
  const editor = screen.getByLabelText("메모 내용") as HTMLTextAreaElement;
  return { editor, user: userEvent.setup() };
}

afterEach(cleanup);

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
