import { FilesetResolver, FaceLandmarker }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { extractPoints, buildFrame, Armor } from './armor.js';
import { Effects } from './effects.js';
import * as sfx from './sound.js';

const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const video = document.getElementById('cam');
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

const gate = document.getElementById('gate');
const gateMsg = document.getElementById('gateMsg');
const startBtn = document.getElementById('startBtn');
const henshinBtn = document.getElementById('henshinBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

const fx = new Effects();
const armor = new Armor(fx);
let faceLandmarker = null;
let lastVideoTime = -1;
let landmarks = null;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let lastFrame = performance.now();
let faceSeen = false;

// EMA-smoothed key points (screen px) to kill detector jitter
let sm = null;
const SMOOTH = 0.5;

armor.onStage = (name) => { if (name) setStatus(name); };
const setStatus = (text) => { statusEl.textContent = text; };

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize);
resize();

// ---- boot -----------------------------------------------------------------
async function boot() {
  startBtn.disabled = true;
  gateMsg.classList.remove('error');
  try {
    gateMsg.textContent = 'カメラを準備中…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    gateMsg.textContent = '顔認識エンジンを読み込み中…';
    const fileset = await FilesetResolver.forVisionTasks(VISION_WASM);
    faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    gate.classList.add('hidden');
    henshinBtn.disabled = false;
    setStatus('顔を画面に合わせてください');
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    startBtn.disabled = false;
    gateMsg.classList.add('error');
    gateMsg.textContent = describeError(err);
  }
}

function describeError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'カメラへのアクセスが拒否されました。ブラウザの権限を許可してください（HTTPS環境が必要です）。';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'インカメラが見つかりませんでした。';
  return '起動に失敗しました：' + (err && err.message ? err.message : err);
}

// ---- render loop ----------------------------------------------------------
function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (faceLandmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const res = faceLandmarker.detectForVideo(video, now);
    landmarks = res && res.faceLandmarks && res.faceLandmarks[0] ? res.faceLandmarks[0] : null;
  }

  armor.update(dt);
  fx.update(dt, armor.power);
  render();
  requestAnimationFrame(loop);
}

// cover-fit transform from normalised video coords -> mirrored canvas px
function coverParams() {
  const cw = canvas.width, ch = canvas.height;
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale, dh = vh * scale;
  return { cw, ch, dw, dh, dx: (cw - dw) / 2, dy: (ch - dh) / 2 };
}

function render() {
  const { cw, ch, dw, dh, dx, dy } = coverParams();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  // build a smoothed face frame
  let F = null;
  if (landmarks) {
    const map = (i) => {
      const p = landmarks[i];
      return { x: cw - (dx + p.x * dw), y: dy + p.y * dh };
    };
    const raw = extractPoints(map);
    if (!sm) sm = raw;
    const lp = (a, b) => ({ x: a.x + (b.x - a.x) * SMOOTH, y: a.y + (b.y - a.y) * SMOOTH });
    sm = { le: lp(sm.le, raw.le), re: lp(sm.re, raw.re), chin: lp(sm.chin, raw.chin) };
    F = buildFrame(sm.le, sm.re, sm.chin);
  } else {
    sm = null;
  }

  // camera shake offset applied to the camera + armour layer
  const sh = fx.shakeOffset();
  ctx.save();
  ctx.translate(sh.x, sh.y);

  if (video.readyState >= 2) {
    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.restore();
  }

  if (F) armor.draw(ctx, F);
  fx.drawParticles(ctx);
  ctx.restore(); // end shake

  // full-screen flash, then HUD (stable, not shaken)
  fx.drawFlash(ctx, cw, ch);
  if (F) fx.drawHud(ctx, F, armor.power, cw, ch);

  // status hints
  if (landmarks) {
    if (!faceSeen) { faceSeen = true; if (!armor.active) setStatus('READY — 変身ボタンを押せ'); }
  } else if (!armor.active) {
    faceSeen = false;
    setStatus('顔を画面に合わせてください');
  }

  // hide the disengage button once the suit is fully released
  if (!armor.active && !resetBtn.hidden) resetBtn.hidden = true;
  henshinBtn.disabled = armor.isReleasing;
}

// ---- UI -------------------------------------------------------------------
startBtn.addEventListener('click', () => { sfx.unlock(); boot(); });

henshinBtn.addEventListener('click', () => {
  sfx.unlock();
  if (armor.isComplete) return;
  armor.start();
  resetBtn.hidden = false;
});

resetBtn.addEventListener('click', () => {
  // play the cinematic disengage; the button hides itself once released
  armor.disengage();
});
