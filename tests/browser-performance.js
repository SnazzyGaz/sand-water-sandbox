// Isolated, unsigned-in test browser. Never attaches to a user's desktop session.
import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const software=process.env.SOFTWARE!=='0';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined),headless:true,args:['--no-sandbox',...(software?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[])]});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:+process.env.DPR||1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.BASE_URL||'http://localhost:5173/');
 await page.waitForFunction(()=>window.sandboxDiagnostics?.ready);
 await page.waitForTimeout(3000);
 await page.evaluate(()=>{window.testFrames=[];let last=performance.now();function sample(t){window.testFrames.push(t-last);last=t;window.testRAF=requestAnimationFrame(sample);}window.testRAF=requestAnimationFrame(sample);window.testStart={wall:performance.now(),sim:window.sandboxDiagnostics.time};});
 await page.waitForTimeout(6000);
 await page.click('#flood');
 await page.waitForTimeout(6000);
 const result=await page.evaluate(()=>{cancelAnimationFrame(window.testRAF);const d=window.sandboxDiagnostics;const seconds=(performance.now()-window.testStart.wall)/1000;const intervals=window.testFrames.slice(1).sort((a,b)=>a-b);return {...d,measuredSeconds:seconds,measuredSimRatio:(d.time-window.testStart.sim)/seconds,measuredFps:intervals.length/(intervals.reduce((a,b)=>a+b,0)/1000),p95FrameMs:intervals[Math.floor(intervals.length*.95)],drawingBuffer:[document.querySelector('canvas').width,document.querySelector('canvas').height],expectedPixelRatio:Math.min(devicePixelRatio,2)};});
 assert.equal(result.pixelRatio,result.expectedPixelRatio,'Canvas must never secretly downscale');
 assert.equal(errors.length,0,errors.join('\n'));
 if(process.env.SCREENSHOT)await page.screenshot({path:process.env.SCREENSHOT});
 if(process.env.REPORT)writeFileSync(process.env.REPORT,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
