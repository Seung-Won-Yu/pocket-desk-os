import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ serviceWorkers: "block", viewport: { width: 1280, height: 820 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 120)); });
await page.goto(process.argv[2]);
const lock = page.locator('[aria-label="PocketDesk 잠금 화면"]');
await lock.waitFor({ state: "visible" });
await lock.click();
await page.getByRole("button", { name: "로그인", exact: true }).click();
await page.locator(".shell-gate").waitFor({ state: "hidden" });
await page.getByRole("button", { name: "시작" }).click();
await page.getByRole("button", { name: /지뢰찾기/ }).first().click();
await page.waitForTimeout(500);
const mines = page.locator('article[aria-label="지뢰찾기"]');
const stage = async (tag) => console.log(tag, JSON.stringify(await page.evaluate(() => {
  const s = document.querySelector(".mines-stage");
  const f = document.querySelector('.window-frame[aria-label="지뢰찾기"]');
  const fr = f.getBoundingClientRect();
  return { scrollW: s.scrollWidth, clientW: s.clientWidth, scrollH: s.scrollHeight, clientH: s.clientHeight,
    frameW: Math.round(fr.width), frameH: Math.round(fr.height) };
})));
await stage("초급:");
await mines.getByRole("combobox").first().selectOption({ label: "고급" }).catch(async () => {
  await mines.getByRole("button", { name: /고급/ }).click();
});
await page.waitForTimeout(600);
await stage("고급:");
const cells = await mines.locator(".mine-cell").count();
const outside = await page.evaluate(() => {
  const f = document.querySelector('.window-frame[aria-label="지뢰찾기"]').getBoundingClientRect();
  return [...document.querySelectorAll(".mine-cell")].filter((c) => {
    const r = c.getBoundingClientRect();
    return r.right > f.right + 1 || r.bottom > f.bottom + 1;
  }).length;
});
console.log("칸 수:", cells, "| 프레임 밖:", outside);

// the reviewer's loop scenario: maximize then minimize
await mines.getByRole("button", { name: "지뢰찾기 최대화" }).click();
await page.waitForTimeout(400);
await mines.getByRole("button", { name: "지뢰찾기 최소화" }).click();
await page.waitForTimeout(1500);
console.log("최대화->최소화 후 오류:", errors.length ? errors.slice(0, 3) : "없음");
console.log("오류 화면:", await page.locator(".shell-error, [class*=error-boundary]").count());
await browser.close();
