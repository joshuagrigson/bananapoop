/* Optional real-browser verification. Requires Playwright; not a runtime dependency.
 * npm install --no-save playwright
 * npx playwright install chromium
 * node tests/browser.test.cjs
 * CHROMIUM_EXECUTABLE=/path/to/chromium may select an existing browser.
 * Does not connect to a TV or publish anything. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}: {})});
  const errors=[];
  try {
    const page=await browser.newPage({viewport:{width:1328,height:1184},deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(e.message));
    const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
    await page.goto(url+'?compare=1');
    await page.waitForFunction(()=>Boolean(window.NexusRemote));
    fs.mkdirSync(path.resolve(__dirname,'../previews'),{recursive:true});
    await page.screenshot({path:path.resolve(__dirname,'../previews/code-comparison.png'),fullPage:true});
    const before=await page.evaluate(()=>NexusRemote.getState());
    const positions=await page.locator('.remote').first().locator('.primary,.volume-row,.playback,.bottom').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
    await page.evaluate(()=>NexusRemote.clearCommands());
    await page.locator('.remote').first().getByRole('tab',{name:'D-pad',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>NexusRemote.getState()),before);
    assert.equal((await page.evaluate(()=>NexusRemote.getCommands())).length,0,'mode toggle must emit no TV command');
    const afterPositions=await page.locator('.remote').first().locator('.primary,.volume-row,.playback,.bottom').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
    assert.deepEqual(afterPositions,positions,'mode change must not move surrounding controls');
    await page.locator('.remote').first().getByRole('button',{name:'SELECT',exact:true}).click();
    assert.equal((await page.evaluate(()=>NexusRemote.getCommands())).at(-1).type,'select');
    await page.locator('.remote').first().getByRole('button',{name:'Volume up',exact:true}).click();
    assert.equal((await page.evaluate(()=>NexusRemote.getState())).rooms.living.volume,19);
    await page.locator('.remote').first().getByRole('tab',{name:'Trackpad',exact:true}).click();
    await page.evaluate(()=>NexusRemote.clearCommands());
    const pad=await page.locator('.remote').first().locator('.track-surface').boundingBox();
    await page.mouse.click(pad.x+pad.width/2,pad.y+pad.height/2);
    assert.equal((await page.evaluate(()=>NexusRemote.getCommands())).at(-1).type,'select');
    await page.evaluate(()=>{NexusRemote.clearCommands();NexusRemote.setAdapter(async c=>{window.lastHostCommand=c;});});
    const volumeBefore=(await page.evaluate(()=>NexusRemote.getState())).rooms.living.volume;
    await page.locator('.remote').first().getByRole('button',{name:'Volume up',exact:true}).click();
    assert.equal((await page.evaluate(()=>NexusRemote.getState())).rooms.living.volume,volumeBefore,'adapter mode waits for confirmed host state');
    assert.equal((await page.evaluate(()=>window.lastHostCommand)).type,'volume');
    for(const width of [320,390,430]) {
      await page.setViewportSize({width,height:900});await page.goto(url);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow at '+width);
      await page.screenshot({path:path.resolve(__dirname,`../previews/trackpad-${width}.png`),fullPage:true});
      await page.evaluate(()=>NexusRemote.setMode('dpad'));
      await page.screenshot({path:path.resolve(__dirname,`../previews/dpad-${width}.png`),fullPage:true});
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: mode isolation, stable layout, command routing, volume, tap-select, adapter state, mobile overflow. Screenshots written to previews/.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
