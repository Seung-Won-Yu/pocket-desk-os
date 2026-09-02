import { toTrustedServiceWorkerUrl } from "../security/trustedWorkerUrl";
import { settleVfsWrites } from "../vfs/storage";
export const PWA_UPDATE_EVENT = "pocketdesk:pwa-update";
export const PWA_CONTROLLER_CHANGE_EVENT = "pocketdesk:pwa-controller-change";

export type PwaUpdateEventDetail = {
  registration: ServiceWorkerRegistration;
};

let updateRegistration: ServiceWorkerRegistration | null = null;
let refreshRequested = false;

function announceWaitingUpdate(registration: ServiceWorkerRegistration) {
  if (!registration.waiting || !navigator.serviceWorker.controller) return;

  updateRegistration = registration;
  window.dispatchEvent(
    new CustomEvent<PwaUpdateEventDetail>(PWA_UPDATE_EVENT, {
      detail: { registration },
    }),
  );
}

function observeRegistration(registration: ServiceWorkerRegistration) {
  announceWaitingUpdate(registration);

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed") {
        announceWaitingUpdate(registration);
      }
    });
  });
}

async function register() {
  const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.origin);
  // Trusted Types refuses a plain string here, so the URL goes through a policy
  // that only ever vouches for this exact path on this origin.
  const trustedUrl = toTrustedServiceWorkerUrl(serviceWorkerUrl);
  const registration = await navigator.serviceWorker.register(trustedUrl, {
    scope: import.meta.env.BASE_URL,
  });
  if (!registration) return;

  observeRegistration(registration);

  const checkForUpdate = () => registration.update().catch(() => undefined);
  window.setInterval(checkForUpdate, 60 * 60 * 1000);
  window.addEventListener("online", checkForUpdate);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
}

export function registerPocketDeskServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    updateRegistration = null;
    window.dispatchEvent(new Event(PWA_CONTROLLER_CHANGE_EVENT));
    if (!refreshRequested) return;
    // This is the one reload the app issues itself, so it is the one that can
    // coincide with a VFS write still committing. Let the write settle first —
    // bounded, so a wedged write can never hold the update hostage.
    const settled = settleVfsWrites();
    const deadline = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1500);
    });
    void Promise.race([settled, deadline]).then(() => window.location.reload());
  });

  const startRegistration = () => {
    register().catch((error) => {
      console.error("PocketDesk service worker registration failed", error);
    });
  };

  if (document.readyState === "complete") {
    startRegistration();
  } else {
    window.addEventListener("load", startRegistration, { once: true });
  }
}

export function getWaitingUpdate() {
  return updateRegistration;
}

export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return false;

  refreshRequested = true;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}
