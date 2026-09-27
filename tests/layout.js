/* Browser layout smoke checks for the menu, table, overlays and loading screen. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const sizes = [
  [320, 568], [360, 640], [390, 844], [768, 1024],
  [1024, 768], [1366, 768], [568, 320], [844, 390]
];
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

function serve() {
  return http.createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data);
    } catch { res.writeHead(404).end(); }
  });
}

async function browserForTests() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    return chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  }
  try { return await chromium.launch({ headless: true }); }
  catch (err) {
    if (process.platform === 'win32') return chromium.launch({ headless: true, channel: 'msedge' });
    throw err;
  }
}

async function boxInside(page, selector, label) {
  const box = await page.locator(selector).first().boundingBox();
  assert(box, label + ' is missing');
  const { width, height } = page.viewportSize();
  const fuzz = 2;
  assert(box.x >= -fuzz && box.y >= -fuzz && box.x + box.width <= width + fuzz && box.y + box.height <= height + fuzz,
    `${label} outside ${width}x${height}: ${JSON.stringify(box)}`);
  return box;
}

async function noHorizontalOverflow(page, label) {
  const data = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert(data.scrollWidth <= data.width + 2, `${label}: horizontal page overflow ${data.scrollWidth}/${data.width}`);
}

function intersects(a, b) {
  return a.x < b.x + b.width - 2 && a.x + a.width > b.x + 2 &&
    a.y < b.y + b.height - 2 && a.y + a.height > b.y + 2;
}

async function snapshot(page, size, screen) {
  if (!process.env.LAYOUT_SCREENSHOTS) return;
  const dir = path.join(root, 'tests', 'artifacts');
  await fs.mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${size[0]}x${size[1]}-${screen}.png`) });
}

async function runSize(browser, base, size) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://sdk.crazygames.com/**', route => route.abort());
  try {
    await page.goto(base);
    await page.locator('#boot-screen').waitFor({ state: 'hidden' });
    await boxInside(page, '#menu .menu-inner', 'menu');
    await boxInside(page, '#btn-play', 'Play button');
    await noHorizontalOverflow(page, 'menu');
    await snapshot(page, size, 'menu');

    await page.locator('#btn-how').click();
    await boxInside(page, '#overlay-root .modal', 'how-to dialog');
    await noHorizontalOverflow(page, 'how-to');
    await snapshot(page, size, 'howto');
    await page.locator('#overlay-root .btn').click();

    await page.locator('#btn-play').click();
    await page.locator('#hand .card').first().waitFor();
    assert.equal(await page.locator('#hand .card').count(), 8);
    const seats = await boxInside(page, '#seats', 'bot seats');
    const center = await boxInside(page, '#center', 'draw and discard piles');
    const hand = await boxInside(page, '#hand', 'player hand');
    await boxInside(page, '#topbar', 'game controls');
    assert(seats.y + seats.height <= center.y + 2, `seats overlap piles at ${size.join('x')}: ${JSON.stringify({ seats, center })}`);
    assert(center.y + center.height <= hand.y + 2, `piles overlap hand at ${size.join('x')}: ${JSON.stringify({ center, hand })}`);
    await noHorizontalOverflow(page, 'table');
    await snapshot(page, size, 'table');

    await page.evaluate(() => { OINK.ui._showOinkButton(0); });
    const oink = await boxInside(page, '#btn-oink', 'OINK button');
    for (const pile of ['#deck-wrap', '#discard-wrap']) {
      assert(!intersects(oink, await page.locator(pile).boundingBox()), `OINK button covers a pile at ${size.join('x')}`);
    }
    for (const card of await page.locator('#hand .card').all()) {
      assert(!intersects(oink, await card.boundingBox()), `OINK button covers a hand card at ${size.join('x')}`);
    }
    await snapshot(page, size, 'oink');
    await page.evaluate(() => { OINK.ui._hideOinkButton(); });

    await page.evaluate(() => { OINK.ui._showDrawnPrompt({ id: 'layout', kind: 'number', color: 'red', value: 5 }); });
    await boxInside(page, '.drawn-prompt', 'drawn card prompt');
    await noHorizontalOverflow(page, 'drawn card prompt');
    await snapshot(page, size, 'drawn');
    await page.evaluate(() => { OINK.ui._hideDrawnPrompt(); });

    await page.evaluate(() => { OINK.ui._showColorPicker(); });
    await boxInside(page, '#overlay-root .modal', 'color picker');
    for (const button of await page.locator('.quad-btn').all()) {
      const rect = await button.boundingBox();
      assert(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= size[0] + 2 && rect.y + rect.height <= size[1] + 2,
        `color button outside ${size.join('x')}`);
    }
    await snapshot(page, size, 'color');
    await page.locator('.quad-btn').first().click();

    await page.evaluate(() => { OINK.ui._showSlap(); });
    await boxInside(page, '.slap-inner', 'Hoof Slap dialog');
    await boxInside(page, '.slap-note', 'Hoof Slap penalty text');
    for (const button of await page.locator('.slap-choices button').all()) {
      const rect = await button.boundingBox();
      assert(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= size[0] + 2 && rect.y + rect.height <= size[1] + 2,
        `Hoof Slap button outside ${size.join('x')}`);
    }
    await noHorizontalOverflow(page, 'Hoof Slap');
    await snapshot(page, size, 'slap');
    await page.evaluate(() => { OINK.ui._game.phase = 'hush'; OINK.ui._game._socialPlayer = 0; OINK.ui._showHush(4000); });
    await boxInside(page, '.hush-inner', 'Hush Pig dialog');
    await snapshot(page, size, 'hush');

    await page.reload();
    await page.locator('#boot-screen').waitFor({ state: 'hidden' });
    await page.locator('#opp-picker button').last().click();
    await page.locator('#btn-play').click();
    await page.locator('#hand .card').first().waitFor();
    const botSeats = await page.locator('#seats .seat').all();
    assert.equal(botSeats.length, 3);
    const seatBoxes = [];
    for (let i = 0; i < botSeats.length; i++) seatBoxes.push(await boxInside(page, `#seats .seat:nth-child(${i + 1})`, `bot seat ${i + 1}`));
    for (let i = 0; i < seatBoxes.length; i++) {
      for (let j = i + 1; j < seatBoxes.length; j++) {
        assert(!intersects(seatBoxes[i], seatBoxes[j]), `bot seats overlap at ${size.join('x')}`);
      }
    }
    const threeCenter = await boxInside(page, '#center', 'piles with three bots');
    const threeHand = await boxInside(page, '#hand', 'hand with three bots');
    for (const seat of seatBoxes) {
      assert(!intersects(seat, threeCenter), `a bot seat covers the piles at ${size.join('x')}`);
    }
    assert(!intersects(threeCenter, threeHand), `piles cover the hand with three bots at ${size.join('x')}`);
    await snapshot(page, size, 'three-bots');

    await page.evaluate(() => { OINK.ui._showRoundEnd({ winner: 0, hands: [0, 8, 8, 8], roundScore: 24 }); });
    const dialog = await boxInside(page, '.round-end', 'round result dialog');
    const score = await page.locator('.score').boundingBox();
    assert(score && score.x >= dialog.x - 2 && score.x + score.width <= dialog.x + dialog.width + 2,
      `round score table overflows dialog at ${size.join('x')}: ${JSON.stringify({ score, dialog })}`);
    await page.locator('.round-end .btn').last().scrollIntoViewIfNeeded();
    await boxInside(page, '.round-end .btn:last-child', 'round result Menu button');
    await noHorizontalOverflow(page, 'round result');
    await snapshot(page, size, 'round-end');
    assert.deepEqual(errors, [], `browser errors at ${size.join('x')}`);
    process.stdout.write(`Layout ${size.join('x')} passed\n`);
  } finally { await context.close(); }
}

async function main() {
  const server = serve();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await browserForTests();
    for (const loadingSize of [[390, 844], [568, 320]]) {
      const context = await browser.newContext({ viewport: { width: loadingSize[0], height: loadingSize[1] }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.route('https://sdk.crazygames.com/**', route => route.abort());
      await page.route('**/js/main.js', async route => {
        await new Promise(resolve => setTimeout(resolve, 900));
        await route.continue();
      });
      const navigation = page.goto(base);
      await page.locator('#boot-screen').waitFor({ state: 'visible' });
      await boxInside(page, '#boot-screen', 'loading screen');
      await boxInside(page, '.boot-card', 'loading illustration');
      await boxInside(page, '#boot-screen p', 'loading text');
      await snapshot(page, loadingSize, 'loading');
      await navigation;
      await page.locator('#boot-screen').waitFor({ state: 'hidden' });
      await context.close();
    }
    for (const size of sizes) await runSize(browser, base, size);
    process.stdout.write('All layout checks passed.\n');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
