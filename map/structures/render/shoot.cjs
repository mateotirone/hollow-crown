// Screenshot a viewer page from several angles with headless Chromium.
//   node shoot.mjs viewer.html outprefix view1,view2 [dusk] [three_dir]
// CDN requests for three.js are answered from a local copy (three_dir/build, three_dir/examples).
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const [,, page_, out, views, light = "day", threeDir = process.env.THREE_DIR] = process.argv;
(async () => {
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("console", m => { if (m.type() === "error") console.log("page:", m.text()); });
page.on("pageerror", e => console.log("pageerror:", e.message));
await page.route("**/cdn.jsdelivr.net/npm/three@0.170.0/**", r => {
  const rel = new URL(r.request().url()).pathname.replace("/npm/three@0.170.0/", "");
  r.fulfill({ body: fs.readFileSync(path.join(threeDir, rel)), contentType: "text/javascript" });
});
for (const v of views.split(",")) {
  await page.goto("about:blank");
  await page.goto("file://" + path.resolve(page_) + "#shot=1&view=" + v + "&light=" + light);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}-${v}${light === "dusk" ? "-dusk" : ""}.png` });
  console.log("shot", v);
}
await browser.close();
})();
