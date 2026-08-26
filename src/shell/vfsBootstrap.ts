import { type AppId, type DesktopItem } from "../types";
import { VFS_DOCUMENTS_ID, VFS_GAMES_ID, VFS_PICTURES_ID, VFS_ROOT_ID, createVfsSystemFolders, getDefaultVfsEntryName, isVfsSystemFolderId } from "../vfs/model";
import { persistVfsEntries, readVfsEntries } from "../vfs/storage";
import { appsById } from "./appCatalog";
import { DESKTOP_ITEMS_KEY, LEGACY_DEFAULT_NOTE_CONTENT, NOTE_KEY, VFS_PRIMARY_CANVAS_ID, VFS_PRIMARY_NOTE_ID } from "./constants";
import { clampIconPosition } from "./desktopLayout";
import { type PersistedDesktopItem } from "./types";

export async function loadDesktopItemsFromVfs(): Promise<DesktopItem[]> {
  const entries = await readVfsEntries((item, index) =>
    normalizePersistedDesktopItem(item as PersistedDesktopItem, index),
  );
  if (entries.length > 0) {
    const migratedEntries = migrateVfsHierarchy(entries);
    await persistVfsEntries(migratedEntries);
    return migratedEntries;
  }

  const seededEntries = migrateVfsHierarchy([
    ...createDefaultVfsEntries(),
    ...loadLegacyDesktopItems(),
  ]);
  await persistVfsEntries(seededEntries);
  return seededEntries;
}

export function migrateVfsHierarchy(entries: DesktopItem[]): DesktopItem[] {
  const withoutLegacyFolder = entries.filter((entry) => entry.id !== "vfs-pictures");
  const hadSystemFolders = [VFS_DOCUMENTS_ID, VFS_PICTURES_ID, VFS_GAMES_ID].every(
    (folderId) => withoutLegacyFolder.some((entry) => entry.id === folderId),
  );
  const systemFolders = createVfsSystemFolders();
  const systemFolderById = new Map(systemFolders.map((folder) => [folder.id, folder]));
  const folderIds = new Set([
    VFS_ROOT_ID,
    ...withoutLegacyFolder
      .filter((entry) => entry.kind === "folder")
      .map((entry) => entry.id),
    ...systemFolders.map((folder) => folder.id),
  ]);
  const seenIds = new Set<string>();
  const migrated = withoutLegacyFolder.flatMap((entry) => {
    if (seenIds.has(entry.id)) return [];
    seenIds.add(entry.id);

    const systemFolder = systemFolderById.get(entry.id);
    if (systemFolder) {
      return [{ ...systemFolder, createdAt: entry.createdAt, updatedAt: entry.updatedAt }];
    }

    let parentId = folderIds.has(entry.parentId) ? entry.parentId : VFS_ROOT_ID;
    if (!hadSystemFolders && parentId === VFS_ROOT_ID && !entry.showOnDesktop) {
      if (entry.kind === "note") parentId = VFS_DOCUMENTS_ID;
      if (entry.kind === "canvas") parentId = VFS_PICTURES_ID;
      if (entry.kind === "game") parentId = VFS_GAMES_ID;
    }

    return [
      {
        ...entry,
        content:
          entry.id === VFS_PRIMARY_NOTE_ID && entry.content === LEGACY_DEFAULT_NOTE_CONTENT
            ? ""
            : entry.content,
        parentId,
      },
    ];
  });

  for (const folder of systemFolders) {
    if (!seenIds.has(folder.id)) migrated.push(folder);
  }

  const migratedById = new Map(migrated.map((entry) => [entry.id, entry]));
  return migrated.map((entry) => {
    if (isVfsSystemFolderId(entry.id)) return entry;
    const visited = new Set([entry.id]);
    let parentId = entry.parentId;
    while (parentId !== VFS_ROOT_ID) {
      if (visited.has(parentId)) return { ...entry, parentId: VFS_ROOT_ID };
      visited.add(parentId);
      const parent = migratedById.get(parentId);
      if (!parent || parent.kind !== "folder") return { ...entry, parentId: VFS_ROOT_ID };
      parentId = parent.parentId;
    }
    return entry;
  });
}

export function createDefaultVfsEntries(): DesktopItem[] {
  const now = Date.now();
  const storedNoteContent = localStorage.getItem(NOTE_KEY);
  const noteContent =
    storedNoteContent && storedNoteContent !== LEGACY_DEFAULT_NOTE_CONTENT ? storedNoteContent : "";

  return [
    ...createVfsSystemFolders(now),
    {
      content: noteContent,
      createdAt: now - 5000,
      id: VFS_PRIMARY_NOTE_ID,
      kind: "note",
      name: "notes.txt",
      parentId: VFS_DOCUMENTS_ID,
      showOnDesktop: false,
      updatedAt: now - 5000,
      x: 0,
      y: 0,
    },
    {
      createdAt: now - 3000,
      id: VFS_PRIMARY_CANVAS_ID,
      kind: "canvas",
      name: "sketch.canvas",
      parentId: VFS_PICTURES_ID,
      showOnDesktop: false,
      updatedAt: now - 3000,
      x: 0,
      y: 0,
    },
    {
      appId: "minesweeper",
      createdAt: now - 2000,
      id: "vfs-minefield",
      kind: "game",
      name: "minefield.game",
      parentId: VFS_GAMES_ID,
      showOnDesktop: false,
      updatedAt: now - 2000,
      x: 0,
      y: 0,
    },
    {
      appId: "browser",
      content: "https://example.com",
      createdAt: now - 1000,
      id: "vfs-web-surf",
      kind: "shortcut",
      name: "web-surf.url",
      parentId: VFS_ROOT_ID,
      showOnDesktop: false,
      updatedAt: now - 1000,
      x: 0,
      y: 0,
    },
  ];
}

export function loadLegacyDesktopItems(): DesktopItem[] {
  const stored = localStorage.getItem(DESKTOP_ITEMS_KEY);
  if (stored === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => normalizePersistedDesktopItem(item as PersistedDesktopItem, index))
      .filter((item): item is DesktopItem => Boolean(item))
      .slice(0, 60);
  } catch {
    return [];
  }
}

export function normalizePersistedDesktopItem(
  item: PersistedDesktopItem,
  index: number,
): DesktopItem | null {
  if (
    item.kind !== "folder" &&
    item.kind !== "note" &&
    item.kind !== "canvas" &&
    item.kind !== "shortcut" &&
    item.kind !== "game"
  ) {
    return null;
  }

  const position = clampIconPosition(Number(item.x), Number(item.y));
  const createdAt = Number(item.createdAt);
  const updatedAt = Number(item.updatedAt);
  const trashedAt = Number(item.trashedAt);
  const trashed = Boolean(item.trashed);
  const showOnDesktop = Boolean(item.showOnDesktop ?? true);

  return {
    appId: typeof item.appId === "string" && appsById.has(item.appId as AppId) ? (item.appId as AppId) : undefined,
    content: typeof item.content === "string" ? item.content : undefined,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - index * 1000,
    id: typeof item.id === "string" ? item.id : `${item.kind}-${crypto.randomUUID()}`,
    kind: item.kind,
    name:
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim().slice(0, 48)
        : getDefaultVfsEntryName(item.kind),
    parentId: typeof item.parentId === "string" ? item.parentId : VFS_ROOT_ID,
    restoreParentId:
      typeof item.restoreParentId === "string" ? item.restoreParentId : undefined,
    restoreShowOnDesktop:
      typeof item.restoreShowOnDesktop === "boolean" ? item.restoreShowOnDesktop : showOnDesktop,
    showOnDesktop: trashed ? false : showOnDesktop,
    trashed,
    trashedAt: Number.isFinite(trashedAt) ? trashedAt : undefined,
    trashedRootId: typeof item.trashedRootId === "string" ? item.trashedRootId : undefined,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Number.isFinite(createdAt) ? createdAt : Date.now(),
    ...position,
  };
}
