// Screenshot many viewer pages in one browser: node shoot_many.cjs jobs.json three_dir
// jobs.json = [[page, out.png, view, width, height], ...]; optional SHARDS SHARD to split the list over processes
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const [,, jobsFile, threeDir, shards = "1", shard = "0"] = process.argv;
const jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8")).filter((_, i) => i % Number(shards) === Number(shard));
(async () => {
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
let i = 0;
for (const [page_, out, view, w = 1400, h = 900] of jobs) {
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(page_).mtimeMs) { i++; continue; }
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror:", e.message));
  await page.route("**/cdn.jsdelivr.net/npm/three@0.170.0/**", r => {
    const rel = new URL(r.request().url()).pathname.replace("/npm/three@0.170.0/", "");
    r.fulfill({ body: fs.readFileSync(path.join(threeDir, rel)), contentType: "text/javascript" });
  });
  await page.goto("file://" + path.resolve(page_) + "#shot=1&view=" + view + "&light=day");
  await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  try { await page.screenshot({ path: out, timeout: 180000 }); }
  catch (e) { console.log("retry", path.basename(path.dirname(out))); await page.waitForTimeout(3000); await page.screenshot({ path: out, timeout: 300000 }); }
  await ctx.close();
  console.log(`shot ${++i}/${jobs.length}`, path.basename(out));
}
await browser.close();
})();
