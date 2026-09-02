// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StickyNotesApp from "./StickyNotesApp";
import { EMPTY_STICKY_STORE, type StickyNoteStore } from "../shell/stickyNotes";
import type { OpenWindowInfo } from "../types";

afterEach(cleanup);

function Harness({
  closeWindow = vi.fn(),
  openNewAppWindow = vi.fn(() => "win-2"),
  onStore = () => {},
  windowId = "win-1",
}: {
  closeWindow?: (id: string) => void;
  openNewAppWindow?: (appId: "stickynotes") => string;
  onStore?: (store: StickyNoteStore) => void;
  windowId?: string;
}) {
  const [store, setStore] = useState<StickyNoteStore>(EMPTY_STICKY_STORE);
  const openWindows: OpenWindowInfo[] = [
    { appId: "stickynotes", id: windowId, maximized: false, minimized: false, title: "" },
  ];
  return (
    <StickyNotesApp
      closeWindow={closeWindow}
      openNewAppWindow={openNewAppWindow}
      openWindows={openWindows}
      playSound={vi.fn()}
      reportDocument={vi.fn()}
      stickyNotes={store}
      updateStickyNotes={(next) => {
        onStore(next);
        setStore(next);
      }}
      windowId={windowId}
    />
  );
}

describe("StickyNotesApp", () => {
  it("binds a fresh note on mount and keeps typed text in the shell store", () => {
    let latest: StickyNoteStore = EMPTY_STICKY_STORE;
    render(<Harness onStore={(store) => (latest = store)} />);

    const textarea = screen.getByLabelText("스티커 메모 내용") as HTMLTextAreaElement;
    expect(latest.notes).toHaveLength(1);
    expect(latest.bindings["win-1"]).toBe(latest.notes[0].id);

    fireEvent.change(textarea, { target: { value: "장보기\n우유" } });
    expect(latest.notes[0].text).toBe("장보기\n우유");
    expect(textarea.value).toBe("장보기\n우유");
  });

  it("swatches recolour the note and the container follows", () => {
    let latest: StickyNoteStore = EMPTY_STICKY_STORE;
    render(<Harness onStore={(store) => (latest = store)} />);
    fireEvent.click(screen.getByRole("button", { name: "분홍 메모" }));
    expect(latest.notes[0].color).toBe("pink");
    expect(document.querySelector(".sticky-note.is-pink")).toBeTruthy();
    expect(screen.getByRole("button", { name: "분홍 메모" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("새 메모 opens another window; 삭제 removes the note and closes this one", () => {
    const openNewAppWindow = vi.fn(() => "win-2");
    const closeWindow = vi.fn();
    let latest: StickyNoteStore = EMPTY_STICKY_STORE;
    render(
      <Harness
        closeWindow={closeWindow}
        onStore={(store) => (latest = store)}
        openNewAppWindow={openNewAppWindow}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "새 메모" }));
    expect(openNewAppWindow).toHaveBeenCalledWith("stickynotes");

    const deletedId = latest.bindings["win-1"];
    fireEvent.click(screen.getByRole("button", { name: "메모 삭제" }));
    expect(closeWindow).toHaveBeenCalledWith("win-1");
    // The deleted note is gone. (In the real shell the window closes with it;
    // the harness keeps the component mounted, so it simply binds a new note.)
    expect(latest.notes.some((note) => note.id === deletedId)).toBe(false);
  });
});
