import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import {
  MAX_CONTENT_BYTES,
  MAX_ENTRY_COUNT,
  VfsStorageError,
  cloneAndValidateSnapshot,
  createWriteCoalescer,
} from "./storage";

/** `lib` is ES2020 here, so `Error.cause` is not part of the ambient Error type. */
type ErrorWithCause = Error & { cause?: unknown };

function makeItem(overrides: Partial<DesktopItem> & { id: string }): DesktopItem {
  return {
    createdAt: 0,
    kind: "note",
    name: overrides.id,
    parentId: "vfs-root",
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function makeItems(count: number): DesktopItem[] {
  return Array.from({ length: count }, (_unused, index) =>
    makeItem({ createdAt: index, id: `note-${index}` }),
  );
}

/** Asserts the call throws a `VfsStorageError` and hands the narrowed error back. */
function expectVfsStorageError(run: () => unknown): VfsStorageError {
  let thrown: unknown;
  let threw = false;

  try {
    run();
  } catch (error) {
    thrown = error;
    threw = true;
  }

  expect(threw, "expected the call to throw").toBe(true);
  expect(thrown).toBeInstanceOf(VfsStorageError);
  if (!(thrown instanceof VfsStorageError)) throw thrown;
  return thrown;
}

// Two bytes short of the limit, so a short tail entry decides whether the
// snapshot lands under, exactly on, or over `MAX_CONTENT_BYTES`.
const FILLER_CONTENT = "a".repeat(MAX_CONTENT_BYTES - 2);

/** A filler entry plus a tail entry, so the byte total is `MAX_CONTENT_BYTES - 2 + tail`. */
function snapshotWithTail(tailContent: string): DesktopItem[] {
  return [
    makeItem({ content: FILLER_CONTENT, id: "filler" }),
    makeItem({ content: tailContent, id: "tail" }),
  ];
}

describe("cloneAndValidateSnapshot", () => {
  describe("entry count limit", () => {
    it("accepts exactly MAX_ENTRY_COUNT entries", () => {
      const entries = makeItems(MAX_ENTRY_COUNT);
      const snapshot = cloneAndValidateSnapshot(entries);

      expect(snapshot).toHaveLength(MAX_ENTRY_COUNT);
      expect(snapshot).toEqual(entries);
    });

    it("rejects one entry more than MAX_ENTRY_COUNT", () => {
      const error = expectVfsStorageError(() =>
        cloneAndValidateSnapshot(makeItems(MAX_ENTRY_COUNT + 1)),
      );

      expect(error.message).toContain(String(MAX_ENTRY_COUNT));
      expect(error.message).toMatch(/최대 2000개/);
    });

    it("reports the count limit before it looks at ids", () => {
      const entries = Array.from({ length: MAX_ENTRY_COUNT + 1 }, () => makeItem({ id: "" }));
      const error = expectVfsStorageError(() => cloneAndValidateSnapshot(entries));

      expect(error.message).toMatch(/최대 2000개/);
      expect(error.message).not.toMatch(/파일 ID/);
    });

    it("accepts an empty snapshot", () => {
      const entries: DesktopItem[] = [];
      const snapshot = cloneAndValidateSnapshot(entries);

      expect(snapshot).toEqual([]);
      expect(snapshot).not.toBe(entries);
    });
  });

  describe("id validation", () => {
    it("accepts distinct non-empty ids", () => {
      const entries = [makeItem({ id: "a" }), makeItem({ id: "b" }), makeItem({ id: "c" })];

      expect(cloneAndValidateSnapshot(entries)).toHaveLength(3);
    });

    it("rejects a duplicate id", () => {
      const entries = [makeItem({ id: "a" }), makeItem({ id: "b" }), makeItem({ id: "a" })];
      const error = expectVfsStorageError(() => cloneAndValidateSnapshot(entries));

      expect(error.message).toMatch(/중복되거나 비어 있는 파일 ID/);
    });

    it("rejects two adjacent entries sharing an id", () => {
      const entries = [makeItem({ id: "same" }), makeItem({ id: "same", name: "other" })];

      expect(() => cloneAndValidateSnapshot(entries)).toThrow(VfsStorageError);
    });

    it("rejects an empty string id", () => {
      const error = expectVfsStorageError(() =>
        cloneAndValidateSnapshot([makeItem({ id: "" })]),
      );

      expect(error.message).toMatch(/중복되거나 비어 있는 파일 ID/);
    });

    it("rejects an entry whose id property is missing", () => {
      const { id: _id, ...withoutId } = makeItem({ id: "note-1" });
      const error = expectVfsStorageError(() =>
        cloneAndValidateSnapshot([withoutId as DesktopItem]),
      );

      expect(error.message).toMatch(/중복되거나 비어 있는 파일 ID/);
    });

    it("rejects a bad id even when earlier entries are valid", () => {
      const entries = [makeItem({ id: "good" }), makeItem({ id: "" })];

      expect(() => cloneAndValidateSnapshot(entries)).toThrow(VfsStorageError);
    });
  });

  describe("content byte accounting", () => {
    it("treats a missing content field as an empty string instead of throwing", () => {
      const entries = [makeItem({ id: "a" }), makeItem({ id: "b" })];
      const snapshot = cloneAndValidateSnapshot(entries);

      expect(snapshot).toHaveLength(2);
      expect(snapshot[0].content).toBeUndefined();
    });

    it("counts a missing content field as zero bytes", () => {
      // MAX_CONTENT_BYTES - 2 + 0 + 2 === MAX_CONTENT_BYTES, so this only
      // passes if the content-less entry contributes nothing.
      const entries = [
        makeItem({ content: FILLER_CONTENT, id: "filler" }),
        makeItem({ id: "no-content" }),
        makeItem({ content: "ab", id: "tail" }),
      ];

      expect(cloneAndValidateSnapshot(entries)).toHaveLength(3);
    });

    it("accepts a total sitting exactly on MAX_CONTENT_BYTES", () => {
      expect(cloneAndValidateSnapshot(snapshotWithTail("ab"))).toHaveLength(2);
    });

    it("accepts a total one byte under MAX_CONTENT_BYTES", () => {
      expect(cloneAndValidateSnapshot(snapshotWithTail("a"))).toHaveLength(2);
    });

    it("rejects a total one byte over MAX_CONTENT_BYTES", () => {
      const error = expectVfsStorageError(() =>
        cloneAndValidateSnapshot(snapshotWithTail("abc")),
      );

      expect(error.message).toMatch(/저장 한도를 초과/);
    });

    it("sums bytes across entries rather than checking each one alone", () => {
      // Neither entry is over the limit by itself; only the total is.
      const half = "a".repeat(MAX_CONTENT_BYTES / 2);
      const entries = [
        makeItem({ content: half, id: "a" }),
        makeItem({ content: `${half}x`, id: "b" }),
      ];

      expect(() => cloneAndValidateSnapshot(entries)).toThrow(VfsStorageError);
      expect(() => cloneAndValidateSnapshot([entries[0]])).not.toThrow();
    });

    it("counts a multi-byte character as more than one byte", () => {
      // One ASCII character fits; one three-byte Hangul syllable does not.
      expect(() => cloneAndValidateSnapshot(snapshotWithTail("a"))).not.toThrow();
      expect(() => cloneAndValidateSnapshot(snapshotWithTail("가"))).toThrow(VfsStorageError);
    });

    it("counts bytes rather than UTF-16 code units", () => {
      // "😀" is two code units but four UTF-8 bytes, while "ab" is two of each.
      expect("😀".length).toBe(2);
      expect(() => cloneAndValidateSnapshot(snapshotWithTail("ab"))).not.toThrow();
      expect(() => cloneAndValidateSnapshot(snapshotWithTail("😀"))).toThrow(VfsStorageError);
    });

    it("allows large content that stays inside the limit", () => {
      const entries = [makeItem({ content: FILLER_CONTENT, id: "filler" })];
      const snapshot = cloneAndValidateSnapshot(entries);

      expect(snapshot[0].content).toBe(FILLER_CONTENT);
    });
  });

  describe("shallow clone", () => {
    it("returns a new array holding new entry objects", () => {
      const entries = [makeItem({ id: "a" }), makeItem({ id: "b" })];
      const snapshot = cloneAndValidateSnapshot(entries);

      expect(snapshot).not.toBe(entries);
      expect(snapshot).toEqual(entries);
      snapshot.forEach((entry, index) => {
        expect(entry).not.toBe(entries[index]);
        expect(entry).toEqual(entries[index]);
      });
    });

    it("does not leak mutations of a returned entry back into the input", () => {
      const entries = [makeItem({ content: "hello", id: "note-1", name: "note" })];
      const snapshot = cloneAndValidateSnapshot(entries);

      snapshot[0].name = "renamed";
      snapshot[0].content = "changed";
      snapshot[0].trashed = true;

      expect(entries[0].name).toBe("note");
      expect(entries[0].content).toBe("hello");
      expect(entries[0].trashed).toBeUndefined();
    });

    it("does not leak later mutations of the input into the returned snapshot", () => {
      const entries = [makeItem({ content: "hello", id: "note-1", name: "note" })];
      const snapshot = cloneAndValidateSnapshot(entries);

      entries[0].name = "renamed";
      entries[0].content = "changed";
      entries.push(makeItem({ id: "note-2" }));

      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].name).toBe("note");
      expect(snapshot[0].content).toBe("hello");
    });

    it("does not leak mutations of the returned array into the input array", () => {
      const entries = [makeItem({ id: "a" })];
      const snapshot = cloneAndValidateSnapshot(entries);

      snapshot.push(makeItem({ id: "b" }));
      snapshot.reverse();

      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("a");
    });

    it("copies every own property and adds none", () => {
      const entry = makeItem({
        appId: "notepad",
        content: "body",
        id: "a",
        kind: "shortcut",
        restoreParentId: "parent",
        restoreShowOnDesktop: true,
        trashed: true,
        trashedAt: 42,
        trashedRootId: "root",
      });
      const snapshot = cloneAndValidateSnapshot([entry]);

      expect(Object.keys(snapshot[0]).sort()).toEqual(Object.keys(entry).sort());
      expect(snapshot[0]).toEqual(entry);
    });

    it("preserves entry order", () => {
      const entries = [makeItem({ id: "c" }), makeItem({ id: "a" }), makeItem({ id: "b" })];
      const snapshot = cloneAndValidateSnapshot(entries);

      expect(snapshot.map((entry) => entry.id)).toEqual(["c", "a", "b"]);
    });
  });
});

describe("VfsStorageError", () => {
  it("is an Error subclass named VfsStorageError", () => {
    const error = new VfsStorageError("boom");

    expect(error).toBeInstanceOf(VfsStorageError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("VfsStorageError");
    expect(error.message).toBe("boom");
    expect(typeof error.stack).toBe("string");
  });

  it("preserves a cause that is passed in", () => {
    const cause = new Error("underlying");
    const error: ErrorWithCause = new VfsStorageError("boom", cause);

    expect(error.cause).toBe(cause);
  });

  it("preserves a non-Error cause", () => {
    const cause = { code: "AbortError" };
    const error: ErrorWithCause = new VfsStorageError("boom", cause);

    expect(error.cause).toBe(cause);
  });

  it("does not define cause when none is given", () => {
    const error = new VfsStorageError("boom");

    expect("cause" in error).toBe(false);
  });

  it("does not define cause when it is explicitly undefined", () => {
    const error = new VfsStorageError("boom", undefined);

    expect("cause" in error).toBe(false);
  });

  it("keeps a null cause, which is distinct from an absent one", () => {
    const error: ErrorWithCause = new VfsStorageError("boom", null);

    expect("cause" in error).toBe(true);
    expect(error.cause).toBeNull();
  });

  it("is what the validator throws, rather than a plain Error", () => {
    const error = expectVfsStorageError(() =>
      cloneAndValidateSnapshot(makeItems(MAX_ENTRY_COUNT + 1)),
    );

    expect(error.name).toBe("VfsStorageError");
    expect(error.constructor).toBe(VfsStorageError);
    expect("cause" in error).toBe(false);
  });
});

describe("createWriteCoalescer", () => {
  it("collapses a synchronous burst into a single write of the newest value", async () => {
    const written: number[] = [];
    const save = createWriteCoalescer<number>(async (value) => {
      written.push(value);
    });

    const results: Promise<void>[] = [];
    for (let index = 1; index <= 100; index += 1) results.push(save(index));
    await Promise.all(results);

    // 100 queued saves used to mean 100 full-database rewrites.
    expect(written.length).toBeLessThanOrEqual(2);
    expect(written[written.length - 1]).toBe(100);
  });

  it("a value arriving mid-write is written next, not dropped", async () => {
    const written: string[] = [];
    let releaseFirst: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let signalFirstStarted: () => void = () => {};
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    const save = createWriteCoalescer<string>(async (value) => {
      if (value === "first") {
        signalFirstStarted();
        await gate;
      }
      written.push(value);
    });

    const first = save("first");
    await firstStarted; // the first write is genuinely in flight
    const third = save("third"); // arrives mid-write: must run afterwards
    releaseFirst();
    await Promise.all([first, third]);

    expect(written).toEqual(["first", "third"]);
  });

  it("a rejected write does not wedge the queue", async () => {
    const written: string[] = [];
    const save = createWriteCoalescer<string>(async (value) => {
      if (value === "bad") throw new Error("quota");
      written.push(value);
    });

    await save("bad").catch(() => undefined);
    await save("good");
    expect(written).toEqual(["good"]);
  });
});
