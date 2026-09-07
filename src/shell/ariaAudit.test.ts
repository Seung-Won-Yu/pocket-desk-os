// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
// The accessibility gate's rules, kept pure so each one can be shown to fire.
// @ts-expect-error -- a plain .mjs build script, deliberately untyped
import { auditAria } from "../../scripts/ariaAudit.mjs";

interface Defect {
  detail: string;
  rule: string;
}

afterEach(() => {
  document.body.innerHTML = "";
});

function audit(html: string): Defect[] {
  document.body.innerHTML = html;
  return auditAria("body") as Defect[];
}

const rules = (html: string) => audit(html).map((defect) => defect.rule);

describe("auditAria", () => {
  it("passes markup that is already right", () => {
    expect(
      audit(`
        <div role="tablist" aria-label="탐색기 탭">
          <div role="tab" aria-label="바탕 화면" aria-selected="true" tabindex="0">
            <span>바탕 화면</span>
          </div>
        </div>
        <article>
          <button type="button">열기</button>
          <button type="button" aria-label="지우기"></button>
        </article>
        <label for="q">찾기</label><input id="q" />
        <img src="a.png" alt="" />`),
    ).toEqual([]);
  });

  // The three defects that shipped, each in the shape it shipped in.
  it("catches a tablist whose children are not tabs", () => {
    const found = rules(`
      <div role="tablist" aria-label="탐색기 탭">
        <div class="file-tab"><button role="tab" aria-selected="true">바탕 화면</button></div>
        <button aria-label="새 탭">+</button>
      </div>`);
    // Two children, neither a tab: the wrapper and the 새 탭 button.
    expect(found.filter((rule) => rule === "tablist-children")).toHaveLength(2);
  });

  it("catches a tab with no tablist above it", () => {
    expect(rules('<div><button role="tab" aria-selected="true">성능</button></div>')).toContain(
      "orphan-tab",
    );
  });

  it("catches a control nested inside another control", () => {
    /*
     * Built with DOM calls, not markup: the HTML parser closes an open button
     * when it meets the next one, so this shape can only be *rendered* — which
     * is exactly what React did here, and why no HTML validator saw it.
     */
    const row = document.createElement("button");
    row.className = "notification-item";
    const title = document.createElement("strong");
    title.textContent = "스크린샷";
    row.append(title);
    const dismiss = document.createElement("button");
    dismiss.className = "notification-dismiss";
    dismiss.setAttribute("aria-label", "알림 지우기");
    dismiss.textContent = "x";
    row.append(dismiss);
    document.body.replaceChildren(row);
    const found = auditAria("body") as Defect[];
    expect(found.map((defect) => defect.rule)).toContain("nested-interactive");
    expect(found.find((defect) => defect.rule === "nested-interactive")?.detail).toContain(
      "notification-dismiss",
    );
  });

  it("catches a reference to an id that is not in the document", () => {
    const found = audit(`
      <div role="tablist">
        <button role="tab" aria-controls="taskmgr-panel-performance" aria-selected="false">성능</button>
      </div>`);
    expect(found.map((defect) => defect.rule)).toContain("dangling-reference");
    expect(found.find((defect) => defect.rule === "dangling-reference")?.detail).toContain(
      "taskmgr-panel-performance",
    );
  });

  it("catches an unnamed control, a duplicate id and a stray aria-selected", () => {
    expect(rules('<button type="button"></button>')).toContain("missing-name");
    expect(rules('<div><b id="x">a</b><b id="x">b</b></div>')).toContain("duplicate-id");
    expect(rules('<div aria-selected="true">그냥 칸</div>')).toContain(
      "aria-selected-misplaced",
    );
  });

  it("catches an image with no alt at all, and role=none on something focusable", () => {
    expect(rules('<img src="a.png" />')).toContain("image-without-alt");
    expect(rules('<button role="none" aria-label="x" type="button">x</button>')).toContain(
      "presentation-conflict",
    );
  });

  it("catches menu and listbox items with no such parent", () => {
    expect(rules('<div><button role="menuitem">복사</button></div>')).toContain(
      "orphan-menuitem",
    );
    expect(rules('<div><div role="option" aria-selected="true">항목</div></div>')).toContain(
      "orphan-option",
    );
  });

  it("looks past the parts of the page assistive tech never reaches", () => {
    // A window picture is a clone of a real frame; it answers for nothing.
    expect(
      audit(`
        <div class="window-thumbnail-clone">
          <button type="button"></button>
          <div role="tablist"><span>not a tab</span></div>
        </div>
        <div aria-hidden="true"><button type="button"></button></div>
        <div inert><img src="a.png" /></div>`),
    ).toEqual([]);
  });

  it("counts a tab's own close button as allowed, unlike every other control", () => {
    // ARIA 1.3 drops presentational children from `tab` for exactly this: a
    // closable tab has to be able to expose its own ✕.
    expect(
      audit(`
        <div role="tablist" aria-label="탐색기 탭">
          <div role="tab" aria-label="문서" aria-selected="true" tabindex="0">
            <span>문서</span>
            <button aria-label="문서 탭 닫기" type="button">x</button>
          </div>
        </div>`),
    ).toEqual([]);
  });
});
