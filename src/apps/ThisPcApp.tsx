import {
  ChevronRight,
  ExternalLink,
  Folder,
  HardDrive,
  House,
  Info,
  LayoutGrid,
  List,
  Monitor,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AppId } from "../types";
import { clamp, formatStorageSize, normalizeSearchText } from "../utils/format";
import { trapDialogFocus } from "../shell/dialogFocus";

type ThisPcAppProps = {
  openApp: (appId: AppId) => void;
};

export default function ThisPcApp({ openApp }: ThisPcAppProps) {
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);
  const [driveSelected, setDriveSelected] = useState(false);
  const [driveView, setDriveView] = useState<"details" | "tiles">("tiles");
  const [devicesExpanded, setDevicesExpanded] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!navigator.storage?.estimate) {
      setStorageEstimate({});
      return;
    }

    navigator.storage
      .estimate()
      .then((estimate) => {
        if (!cancelled) setStorageEstimate(estimate);
      })
      .catch(() => {
        if (!cancelled) setStorageEstimate({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const quota = storageEstimate?.quota ?? 0;
  const used = storageEstimate?.usage ?? 0;
  const free = Math.max(0, quota - used);
  const drive = {
    free:
      quota > 0
        ? `${formatStorageSize(free)} 사용 가능 / ${formatStorageSize(quota)}`
        : storageEstimate === null
          ? "용량 확인 중"
          : "사용량 정보 없음",
    label: "로컬 디스크 (C:)",
    usage: quota > 0 ? clamp((used / quota) * 100, 1, 100) : 0,
  };
  const driveVisible = normalizeSearchText(drive.label).includes(normalizeSearchText(query));
  const openDrive = () => openApp("files");
  /*
   * The numbers behind 속성 come from the same estimate the tile shows, so the
   * dialog cannot disagree with the bar next to it. A browser that will not
   * estimate reports neither, rather than a made-up total.
   */
  const measured = quota > 0;
  const usedShare = measured ? Math.min(100, (used / quota) * 100) : 0;

  return (
    <div className="this-pc-app app-fill">
      <aside className="this-pc-sidebar">
        <button onClick={() => openApp("files")} type="button">
          <House aria-hidden="true" size={16} />홈
        </button>
        <button onClick={() => openApp("files")} type="button">
          <Folder aria-hidden="true" size={16} />
          바탕 화면
        </button>
        <button aria-current="page" className="is-selected" type="button">
          <Monitor aria-hidden="true" size={16} />내 PC
        </button>
        <button onClick={() => openApp("recycle")} type="button">
          <Trash2 aria-hidden="true" size={16} />
          휴지통
        </button>
      </aside>
      <section className="this-pc-main">
        <div className="file-tab-strip">
          <div className="file-tab">
            <Monitor aria-hidden="true" size={15} />
            <span>내 PC</span>
          </div>
        </div>
        <div className="this-pc-explorer-top">
          <div className="file-address-row">
            <div className="file-address this-pc-address">
              <House aria-hidden="true" size={15} />
              <span>홈</span>
              <span aria-hidden="true">›</span>
              <strong>내 PC</strong>
            </div>
            <label className="file-search">
              <Search aria-hidden="true" size={15} />
              <input
                aria-label="내 PC 검색"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="내 PC 검색"
                value={query}
              />
            </label>
          </div>
          <div className="file-command-strip this-pc-command-strip">
            <button
              className="file-command-action"
              disabled={!driveSelected}
              onClick={openDrive}
              type="button"
            >
              <ExternalLink aria-hidden="true" size={15} />
              <span>열기</span>
            </button>
            <button
              className="file-command-action"
              disabled={!driveSelected}
              onClick={() => setPropertiesOpen(true)}
              type="button"
            >
              <Info aria-hidden="true" size={15} />
              <span>속성</span>
            </button>
            <div aria-label="보기 방식" className="file-view-control" role="group">
              <button
                aria-label="타일 보기"
                aria-pressed={driveView === "tiles"}
                onClick={() => setDriveView("tiles")}
                title="타일 보기"
                type="button"
              >
                <LayoutGrid aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="자세히 보기"
                aria-pressed={driveView === "details"}
                onClick={() => setDriveView("details")}
                title="자세히 보기"
                type="button"
              >
                <List aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="this-pc-content" onClick={() => setDriveSelected(false)}>
          <section className="this-pc-section">
            <button
              aria-expanded={devicesExpanded}
              className="this-pc-section-heading"
              onClick={(event) => {
                event.stopPropagation();
                setDevicesExpanded((current) => !current);
              }}
              type="button"
            >
              <ChevronRight
                aria-hidden="true"
                className={devicesExpanded ? "is-expanded" : ""}
                size={15}
              />
              <span>장치 및 드라이브</span>
              <small>{driveVisible ? 1 : 0}</small>
            </button>
            {devicesExpanded && (
              <div className={`this-pc-drive-list is-${driveView}`}>
                {driveVisible ? (
                  <button
                    aria-pressed={driveSelected}
                    className={driveSelected ? "is-selected" : ""}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDriveSelected(true);
                    }}
                    onContextMenu={(event) => {
                      // Windows opens a drive's 속성 from its own right-click.
                      event.preventDefault();
                      event.stopPropagation();
                      setDriveSelected(true);
                      setPropertiesOpen(true);
                    }}
                    onDoubleClick={openDrive}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      // Enter opens the drive outright rather than needing a
                      // select-then-confirm pair the mouse never has to do.
                      event.preventDefault();
                      event.stopPropagation();
                      openDrive();
                    }}
                    type="button"
                  >
                    <HardDrive aria-hidden="true" size={driveView === "tiles" ? 34 : 20} />
                    <span>
                      <strong>{drive.label}</strong>
                      <span className="drive-meter" aria-hidden="true">
                        <span style={{ width: `${drive.usage}%` }} />
                      </span>
                      <small>{drive.free}</small>
                    </span>
                  </button>
                ) : (
                  <div className="this-pc-empty">
                    <Search aria-hidden="true" size={20} />
                    <span>검색 결과 없음</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
        <div className="file-statusbar">
          <span>{driveVisible ? "1개 항목" : "0개 항목"}</span>
          <span>{driveSelected ? "1개 선택됨" : "선택한 항목 없음"}</span>
        </div>
        {propertiesOpen && (
          <div className="file-properties-overlay">
            <section
              aria-label={`${drive.label} 속성`}
              aria-modal="true"
              className="file-properties-dialog drive-properties"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setPropertiesOpen(false);
                  return;
                }
                trapDialogFocus(event, event.currentTarget);
              }}
              role="dialog"
            >
              <header>
                <HardDrive aria-hidden="true" size={28} />
                <div>
                  <h2>{drive.label}</h2>
                  <span>로컬 디스크</span>
                </div>
                <button
                  aria-label="드라이브 속성 닫기"
                  onClick={() => setPropertiesOpen(false)}
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </header>
              <div className="drive-properties-usage">
                <span
                  aria-hidden="true"
                  className="drive-donut"
                  style={{ "--used-share": `${usedShare}%` } as React.CSSProperties}
                />
                <dl>
                  <div>
                    <dt>
                      <span aria-hidden="true" className="drive-swatch is-used" />
                      사용 중
                    </dt>
                    <dd>{measured ? formatStorageSize(used) : "알 수 없음"}</dd>
                  </div>
                  <div>
                    <dt>
                      <span aria-hidden="true" className="drive-swatch is-free" />
                      사용 가능
                    </dt>
                    <dd>{measured ? formatStorageSize(free) : "알 수 없음"}</dd>
                  </div>
                  <div>
                    <dt>용량</dt>
                    <dd>{measured ? formatStorageSize(quota) : "알 수 없음"}</dd>
                  </div>
                </dl>
              </div>
              <dl className="drive-properties-facts">
                <div>
                  <dt>종류</dt>
                  <dd>로컬 디스크</dd>
                </div>
                <div>
                  <dt>파일 시스템</dt>
                  <dd>PocketDesk VFS (IndexedDB)</dd>
                </div>
                <div>
                  <dt>사용량</dt>
                  <dd>
                    {measured
                      ? `${usedShare.toFixed(1)}% 사용 중`
                      : "브라우저가 사용량을 알려주지 않습니다"}
                  </dd>
                </div>
              </dl>
              <footer>
                <button autoFocus onClick={() => setPropertiesOpen(false)} type="button">
                  확인
                </button>
              </footer>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
