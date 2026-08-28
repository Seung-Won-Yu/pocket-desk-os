import {
  ChevronRight,
  Folder,
  FolderOpen,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { trapDialogFocus } from "../shell/dialogFocus";
import type { SoundEffectName, ToastInput } from "../types";
import { getNextRovingIndex } from "../shell/keyboardNav";

type RegistryEditorAppProps = {
  notify: (toast: ToastInput) => void;
  playSound: (effect: SoundEffectName) => void;
};

type RegistryValueType = "REG_DWORD" | "REG_SZ";

type RegistryValue = {
  data: string;
  name: string;
  storageKey: string;
  type: RegistryValueType;
};

type RegistryKeyNode = {
  id: string;
  label: string;
  values: RegistryValue[];
};

type RegistrySnapshot = {
  /** False when the browser refuses localStorage entirely (some privacy modes). */
  available: boolean;
  values: RegistryValue[];
};

/**
 * HARD CONSTRAINT: this app only ever reads, writes, or removes localStorage keys
 * that begin with `pocket-desk-`. Enumeration skips every other key, and both write
 * paths re-check the prefix before touching storage, so nothing outside the desktop's
 * own namespace is ever listed or modified.
 */
const STORAGE_PREFIX = "pocket-desk-";
const HIVE_ROOT = "HKEY_CURRENT_USER";
const HIVE_PATH = ["컴퓨터", HIVE_ROOT, "Software", "PocketDesk"];
const MAX_DATA_PREVIEW = 220;

function toPascalCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** The segment right after the `pocket-desk-` prefix decides the key node. */
function getGroupToken(storageKey: string) {
  const remainder = storageKey.slice(STORAGE_PREFIX.length);
  const [first] = remainder.split("-");
  return first ? first.toLowerCase() : "general";
}

function inferValueType(data: string): RegistryValueType {
  const trimmed = data.trim();
  if (trimmed === "") return "REG_SZ";
  return Number.isFinite(Number(trimmed)) ? "REG_DWORD" : "REG_SZ";
}

function formatValueData(value: RegistryValue) {
  if (value.data === "") return "(비어 있음)";
  if (value.type === "REG_DWORD") {
    const numeric = Number(value.data.trim());
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 0xffffffff) {
      return `0x${numeric.toString(16).padStart(8, "0")} (${numeric})`;
    }
  }
  if (value.data.length > MAX_DATA_PREVIEW) return `${value.data.slice(0, MAX_DATA_PREVIEW)}…`;
  return value.data;
}

/** Reads the live browser storage. Only `pocket-desk-` keys are enumerated. */
function readRegistrySnapshot(): RegistrySnapshot {
  try {
    const values: RegistryValue[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey || !storageKey.startsWith(STORAGE_PREFIX)) continue;
      const data = localStorage.getItem(storageKey);
      if (data === null) continue;
      values.push({
        data,
        name: toPascalCase(storageKey.slice(STORAGE_PREFIX.length)),
        storageKey,
        type: inferValueType(data),
      });
    }
    return { available: true, values };
  } catch {
    return { available: false, values: [] };
  }
}

function writeRegistryValue(storageKey: string, data: string) {
  // Guard: never write outside the `pocket-desk-` namespace.
  if (!storageKey.startsWith(STORAGE_PREFIX)) return false;
  try {
    localStorage.setItem(storageKey, data);
    return true;
  } catch {
    return false;
  }
}

function removeRegistryValue(storageKey: string) {
  // Guard: never delete outside the `pocket-desk-` namespace.
  if (!storageKey.startsWith(STORAGE_PREFIX)) return false;
  try {
    localStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Key nodes are derived from whatever keys exist right now, never from a fixed list,
 * so a feature that adds `pocket-desk-something-v1` shows up without a code change.
 * Plural and singular spellings of the same token collapse into one node, but only
 * when both spellings are actually present (`icon-view-v1` + `icons-v2` -> `Icons`).
 */
function buildRegistryTree(values: RegistryValue[]): RegistryKeyNode[] {
  const tokens = new Set(values.map((value) => getGroupToken(value.storageKey)));
  const groups = new Map<string, { spellings: Set<string>; values: RegistryValue[] }>();

  for (const value of values) {
    const token = getGroupToken(value.storageKey);
    const singular = token.slice(0, -1);
    const canonical = token.endsWith("s") && tokens.has(singular) ? singular : token;
    const group = groups.get(canonical) ?? { spellings: new Set<string>(), values: [] };
    group.spellings.add(token);
    group.values.push(value);
    groups.set(canonical, group);
  }

  return [...groups.entries()]
    .map(([id, group]) => {
      const spellings = [...group.spellings].sort(
        (first, second) => second.length - first.length || first.localeCompare(second),
      );
      return {
        id,
        label: toPascalCase(spellings[0]),
        values: group.values.sort((first, second) => first.name.localeCompare(second.name)),
      };
    })
    .sort((first, second) => first.label.localeCompare(second.label));
}

function RegistryEditDialog({
  onCancel,
  onSubmit,
  value,
}: {
  onCancel: () => void;
  onSubmit: (data: string) => void;
  value: RegistryValue;
}) {
  const [draft, setDraft] = useState(value.data);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      previousFocus?.focus();
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(draft);
  };

  return (
    /*
     * regedit's value editor is modal: clicking beside it does nothing.
     * Dismissing on an outside pointerdown threw away whatever had been typed,
     * with no warning and no way to get it back. preventDefault keeps the click
     * from pulling focus out of the dialog, so Escape still cancels afterwards.
     */
    <div className="confirm-overlay" onPointerDown={(event) => event.preventDefault()}>
      <form
        aria-labelledby="registry-edit-title"
        aria-modal="true"
        className="confirm-dialog registry-edit-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <h2 id="registry-edit-title">
          {value.type === "REG_DWORD" ? "DWORD 값 편집" : "문자열 편집"}
        </h2>
        <label className="registry-edit-field">
          <span>값 이름</span>
          <input aria-label="값 이름" readOnly value={value.name} />
        </label>
        <label className="registry-edit-field">
          <span>값 데이터</span>
          <input
            aria-label="값 데이터"
            onChange={(event) => setDraft(event.target.value)}
            ref={inputRef}
            spellCheck={false}
            value={draft}
          />
        </label>
        <p className="registry-edit-key">저장소 키: {value.storageKey}</p>
        <div>
          <button onClick={onCancel} type="button">
            취소
          </button>
          <button type="submit">확인</button>
        </div>
      </form>
    </div>
  );
}

function RegistryDeleteDialog({
  onCancel,
  onConfirm,
  value,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  value: RegistryValue;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  return (
    <div className="confirm-overlay" onPointerDown={onCancel}>
      <section
        aria-labelledby="registry-delete-title"
        aria-modal="true"
        className="confirm-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h2 id="registry-delete-title">값을 삭제하시겠습니까?</h2>
        <p>
          {value.name} 값을 지우면 되돌릴 수 없습니다. 해당 설정은 기본값으로 돌아갑니다.
          <br />
          저장소 키: {value.storageKey}
        </p>
        <div>
          <button onClick={onCancel} ref={cancelRef} type="button">
            취소
          </button>
          <button className="is-danger" onClick={onConfirm} type="button">
            삭제
          </button>
        </div>
      </section>
    </div>
  );
}

export default function RegistryEditorApp({ notify, playSound }: RegistryEditorAppProps) {
  const [snapshot, setSnapshot] = useState<RegistrySnapshot>(readRegistrySnapshot);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [selectedValueKey, setSelectedValueKey] = useState<string | null>(null);
  // The grid is one tab stop; arrows move the active row.
  const [activeIndex, setActiveIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [treeExpanded, setTreeExpanded] = useState(true);
  const [editTarget, setEditTarget] = useState<RegistryValue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RegistryValue | null>(null);

  const tree = useMemo(() => buildRegistryTree(snapshot.values), [snapshot.values]);
  const activeKey: RegistryKeyNode | null =
    tree.find((node) => node.id === selectedKeyId) ?? tree[0] ?? null;
  const activeValue =
    activeKey?.values.find((value) => value.storageKey === selectedValueKey) ?? null;
  const keyPath = activeKey ? [...HIVE_PATH, activeKey.label].join("\\") : HIVE_PATH.join("\\");

  const refresh = () => {
    const next = readRegistrySnapshot();
    setSnapshot(next);
    setSelectedValueKey(null);
    playSound("click");
    notify({
      detail: next.available
        ? `${STORAGE_PREFIX} 로 시작하는 값 ${next.values.length}개를 읽었습니다.`
        : "브라우저가 저장소 접근을 막고 있습니다.",
      title: next.available ? "레지스트리를 새로 고쳤습니다" : "레지스트리를 읽지 못했습니다",
      tone: "info",
    });
  };

  const selectKey = (nodeId: string) => {
    playSound("click");
    setSelectedKeyId(nodeId);
    setSelectedValueKey(null);
  };

  const openEditor = (value: RegistryValue) => {
    playSound("click");
    setSelectedValueKey(value.storageKey);
    setEditTarget(value);
  };

  const applyEdit = (data: string) => {
    if (!editTarget) return;
    if (!writeRegistryValue(editTarget.storageKey, data)) {
      playSound("error");
      notify({
        detail: "브라우저가 저장소 쓰기를 막았습니다.",
        title: "값을 저장하지 못했습니다",
        tone: "info",
      });
      return;
    }
    setSnapshot(readRegistrySnapshot());
    setEditTarget(null);
    playSound("success");
    notify({
      detail: `${editTarget.name} · 다시 시작하거나 새로 고친 뒤에 적용됩니다.`,
      title: "값을 저장했습니다",
      tone: "success",
    });
  };

  const applyDelete = () => {
    if (!deleteTarget) return;
    if (!removeRegistryValue(deleteTarget.storageKey)) {
      playSound("error");
      notify({
        detail: "브라우저가 저장소 삭제를 막았습니다.",
        title: "값을 삭제하지 못했습니다",
        tone: "info",
      });
      return;
    }
    setSnapshot(readRegistrySnapshot());
    setDeleteTarget(null);
    setSelectedValueKey(null);
    playSound("success");
    notify({
      detail: `${deleteTarget.name} · 다시 시작하면 기본값으로 돌아갑니다.`,
      title: "값을 삭제했습니다",
      tone: "success",
    });
  };

  return (
    <div
      className="registry-app"
      onContextMenu={(event) => {
        // Chrome's own menu was opening over the fake desktop; every other app
        // here keeps the right click for the shell.
        event.preventDefault();
      }}
    >
      <p className="registry-warning">
        <TriangleAlert aria-hidden="true" size={15} />
        여기서 바꾼 값은 바탕 화면을 다시 시작하거나 페이지를 새로 고친 뒤에 적용됩니다.
      </p>

      <div className="registry-body">
        <nav aria-label="레지스트리 키" className="registry-tree">
          <p className="registry-tree-root">
            <Folder aria-hidden="true" size={15} />
            컴퓨터
          </p>
          <p className="registry-tree-branch">
            <Folder aria-hidden="true" size={14} />
            {HIVE_ROOT}
          </p>
          <button
            aria-expanded={treeExpanded}
            className="registry-tree-toggle"
            onClick={() => setTreeExpanded((current) => !current)}
            type="button"
          >
            <ChevronRight
              aria-hidden="true"
              className={treeExpanded ? "is-expanded" : ""}
              size={14}
            />
            Software\PocketDesk
          </button>
          {treeExpanded && (
            <div className="registry-tree-group">
              {tree.length === 0 ? (
                <p className="registry-tree-empty">키 없음</p>
              ) : (
                tree.map((node) => (
                  <button
                    aria-current={node.id === activeKey?.id ? "true" : undefined}
                    className={node.id === activeKey?.id ? "is-selected" : ""}
                    key={node.id}
                    onClick={() => selectKey(node.id)}
                    type="button"
                  >
                    {node.id === activeKey?.id ? (
                      <FolderOpen aria-hidden="true" size={14} />
                    ) : (
                      <Folder aria-hidden="true" size={14} />
                    )}
                    <span>{node.label}</span>
                    <small>{node.values.length}</small>
                  </button>
                ))
              )}
            </div>
          )}
        </nav>

        <section className="registry-main">
          <header className="registry-toolbar">
            <button onClick={refresh} type="button">
              <RefreshCw aria-hidden="true" size={14} />
              새로 고침
            </button>
            <button
              disabled={!activeValue}
              onClick={() => activeValue && openEditor(activeValue)}
              type="button"
            >
              <Pencil aria-hidden="true" size={14} />
              수정
            </button>
            <button
              className="registry-danger"
              disabled={!activeValue}
              onClick={() => {
                if (!activeValue) return;
                playSound("click");
                setDeleteTarget(activeValue);
              }}
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} />
              삭제
            </button>
          </header>

          <div aria-label="레지스트리 값" className="registry-table" role="grid">
            <div className="registry-row is-head" role="row">
              <span role="columnheader">이름</span>
              <span role="columnheader">종류</span>
              <span role="columnheader">데이터</span>
            </div>
            {!snapshot.available ? (
              <p className="registry-empty">
                브라우저가 저장소를 막고 있어 레지스트리를 읽을 수 없습니다.
              </p>
            ) : !activeKey ? (
              <p className="registry-empty">{STORAGE_PREFIX} 로 시작하는 값이 없습니다.</p>
            ) : (
              activeKey.values.map((value, index) => (
                <div
                  aria-selected={value.storageKey === selectedValueKey}
                  className={`registry-row${
                    value.storageKey === selectedValueKey ? " is-selected" : ""
                  }`}
                  key={value.storageKey}
                  onClick={() => {
                    setSelectedValueKey(value.storageKey);
                    setActiveIndex(index);
                  }}
                  onDoubleClick={() => openEditor(value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openEditor(value);
                      return;
                    }
                    if (event.key === " ") {
                      event.preventDefault();
                      setSelectedValueKey(value.storageKey);
                      return;
                    }
                    /*
                     * regedit's own shortcuts. Only Enter, Space and the arrows
                     * were handled, so deleting, renaming and refreshing were
                     * reachable from the toolbar alone.
                     */
                    if (event.key === "Delete") {
                      event.preventDefault();
                      setSelectedValueKey(value.storageKey);
                      playSound("click");
                      setDeleteTarget(value);
                      return;
                    }
                    if (event.key === "F2") {
                      event.preventDefault();
                      setSelectedValueKey(value.storageKey);
                      openEditor(value);
                      return;
                    }
                    if (event.key === "F5") {
                      event.preventDefault();
                      refresh();
                      return;
                    }
                    const next = getNextRovingIndex(event.key, index, activeKey.values.length);
                    if (next === null) return;
                    event.preventDefault();
                    setActiveIndex(next);
                    rowRefs.current[next]?.focus();
                  }}
                  ref={(node) => {
                    rowRefs.current[index] = node;
                  }}
                  role="row"
                  /*
                   * Clamped the way the minefield clamps its own grid: without
                   * it, moving from a key with four values to one with a single
                   * value left activeIndex at 3, so no row carried tabindex 0
                   * and Tab walked straight out of the window past the list.
                   */
                  tabIndex={
                    index === Math.min(activeIndex, activeKey.values.length - 1) ? 0 : -1
                  }
                >
                  <span className="registry-name" role="cell">
                    <em aria-hidden="true" className="registry-badge">
                      {value.type === "REG_DWORD" ? "011" : "ab"}
                    </em>
                    <strong>{value.name}</strong>
                  </span>
                  <span role="cell">{value.type}</span>
                  <span className="registry-data" role="cell">
                    {formatValueData(value)}
                  </span>
                </div>
              ))
            )}
          </div>

          <footer className="registry-status">
            <span>{keyPath}</span>
            <span>값 {activeKey?.values.length ?? 0}개</span>
            {activeValue && <span>저장소 키: {activeValue.storageKey}</span>}
          </footer>
        </section>
      </div>

      {editTarget && (
        <RegistryEditDialog
          onCancel={() => setEditTarget(null)}
          onSubmit={applyEdit}
          value={editTarget}
        />
      )}
      {deleteTarget && (
        <RegistryDeleteDialog
          onCancel={() => setDeleteTarget(null)}
          onConfirm={applyDelete}
          value={deleteTarget}
        />
      )}
    </div>
  );
}
