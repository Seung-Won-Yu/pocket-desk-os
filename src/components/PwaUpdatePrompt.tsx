import { RefreshCw, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  applyServiceWorkerUpdate,
  getWaitingUpdate,
  PWA_CONTROLLER_CHANGE_EVENT,
  PWA_UPDATE_EVENT,
  type PwaUpdateEventDetail,
} from "../pwa/registerServiceWorker";

export default function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [applying, setApplying] = useState(false);
  const dismissedWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    const waitingUpdate = getWaitingUpdate();
    if (waitingUpdate) setRegistration(waitingUpdate);

    const handleUpdate = (event: Event) => {
      const nextRegistration = (event as CustomEvent<PwaUpdateEventDetail>).detail.registration;
      if (nextRegistration.waiting === dismissedWorkerRef.current) return;

      setApplying(false);
      setRegistration(nextRegistration);
    };

    window.addEventListener(PWA_UPDATE_EVENT, handleUpdate);
    const handleControllerChange = () => setRegistration(null);
    window.addEventListener(PWA_CONTROLLER_CHANGE_EVENT, handleControllerChange);
    return () => {
      window.removeEventListener(PWA_UPDATE_EVENT, handleUpdate);
      window.removeEventListener(PWA_CONTROLLER_CHANGE_EVENT, handleControllerChange);
    };
  }, []);

  if (!registration) return null;

  const installUpdate = () => {
    setApplying(true);
    if (!applyServiceWorkerUpdate(registration)) {
      setApplying(false);
      setRegistration(null);
    }
  };

  return (
    <aside aria-label="PocketDesk 업데이트" className="pwa-update-prompt" role="status">
      <header>
        <span className="pwa-update-icon">
          <RefreshCw aria-hidden="true" size={17} />
        </span>
        <strong>PocketDesk 업데이트</strong>
        <button
          aria-label="업데이트 알림 닫기"
          disabled={applying}
          onClick={() => {
            dismissedWorkerRef.current = registration.waiting;
            setRegistration(null);
          }}
          title="닫기"
          type="button"
        >
          <X aria-hidden="true" size={14} />
        </button>
      </header>
      <p>새 버전을 사용할 준비가 되었습니다.</p>
      <button
        className="pwa-update-apply"
        disabled={applying}
        onClick={installUpdate}
        type="button"
      >
        <RotateCw aria-hidden="true" size={15} />
        {applying ? "다시 시작하는 중..." : "지금 다시 시작"}
      </button>
    </aside>
  );
}
