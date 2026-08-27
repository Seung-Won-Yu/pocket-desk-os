/**
 * `frame-ancestors 'none'` is header-only, and GitHub Pages cannot set headers.
 * Without it a hostile page could frame this app and overlay its own UI on the
 * real one — clickjacking a user into actions on their stored files.
 *
 * So the app refuses to render inside a frame. Hosts that *can* set headers get
 * the real directive as well (see scripts/security-policy.mjs); this is the
 * fallback for the one that cannot.
 */
export function isFramed() {
  try {
    return window.top !== window.self;
  } catch {
    // A cross-origin parent makes window.top unreadable, which is itself proof
    // that something else is framing this page.
    return true;
  }
}

export function renderFrameRefusal(container: HTMLElement) {
  container.textContent = "";

  const panel = document.createElement("section");
  panel.className = "shell-crash-screen";
  panel.setAttribute("role", "alert");

  const inner = document.createElement("div");
  inner.className = "shell-crash-panel";

  const heading = document.createElement("h1");
  heading.textContent = "PocketDesk OS는 다른 사이트 안에서 실행되지 않습니다";

  const detail = document.createElement("p");
  detail.textContent =
    "이 페이지가 프레임 안에 있습니다. 저장된 파일을 노린 클릭 가로채기를 막기 위해 실행을 거부했습니다.";

  const link = document.createElement("a");
  link.href = window.location.href;
  link.rel = "noreferrer";
  link.target = "_blank";
  link.textContent = "새 탭에서 열기";

  inner.append(heading, detail, link);
  panel.append(inner);
  container.append(panel);
}
