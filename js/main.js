import { FilesetResolver, FaceLandmarker }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { extractPoints, buildFrame } from './gfx.js';
import { Transformer } from './transformer.js';
import { MASKS } from './masks.js';
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
const photoBtn = document.getElementById('photoBtn');
const statusEl = document.getElementById('status');
const maskStrip = document.getElementById('maskStrip');
const photoView = document.getElementById('photoView');
const photoImg = document.getElementById('photoImg');
const photoSave = document.getElementById('photoSave');
const photoClose = document.getElementById('photoClose');

const fx = new Effects();
const tf = new Transformer(fx);
let faceLandmarker = null;
let lastVideoTime = -1;
let landmarks = null;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let lastFrame = performance.now();
let faceSeen = false;
let sm = null;                 // EMA-smoothed key points
const SMOOTH = 0.5;
let pendingCapture = false;
let photoBlob = null;

tf.setMask(MASKS[0]);
tf.onStage = (name) => { if (name) setStatus(name); };
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

// ---- mask selector ----------------------------------------------------------
function buildMaskStrip() {
  maskStrip.innerHTML = '';
  MASKS.forEach((m, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'mask-chip' + (i === 0 ? ' active' : '');
    chip.innerHTML = `<span class="em">${m.emoji}</span><span class="nm">${m.name}</span>`;
    chip.addEventListener('click', () => selectMask(i));
    maskStrip.appendChild(chip);
  });
}
function selectMask(i) {
  sfx.unlock();
  tf.setMask(MASKS[i]);                 // resets any active transformation
  [...maskStrip.children].forEach((c, k) => c.classList.toggle('active', k === i));
  resetBtn.hidden = true;
  setStatus(landmarks ? `READY — ${MASKS[i].name}に変身` : '顔を画面に合わせてください');
}

// ---- boot -------------------------------------------------------------------
async function boot() {
  startBtn.disabled = true;
  gateMsg.classList.remove('error');
  try {
    gateMsg.textContent = 'カメラを準備中…';
    // Request a stream that matches the screen's orientation so the selfie view
    // isn't heavily cropped/zoomed (front cameras default to landscape).
    const portrait = window.innerHeight >= window.innerWidth;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: portrait ? 720 : 1280 },
        height: { ideal: portrait ? 1280 : 720 },
        aspectRatio: { ideal: window.innerWidth / window.innerHeight },
      },
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
    buildMaskStrip();
    maskStrip.hidden = false;
    henshinBtn.disabled = false;
    photoBtn.disabled = false;
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

// ---- render loop ------------------------------------------------------------
function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (faceLandmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const res = faceLandmarker.detectForVideo(video, now);
    landmarks = res && res.faceLandmarks && res.faceLandmarks[0] ? res.faceLandmarks[0] : null;
  }

  tf.update(dt);
  fx.update(dt, tf.power);
  render();
  requestAnimationFrame(loop);
}

function coverParams() {
  const cw = canvas.width, ch = canvas.height;
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
  // "fit" (contain): show the whole camera frame — wider, no heavy zoom/crop.
  const scale = Math.min(cw / vw, ch / vh);
  const dw = vw * scale, dh = vh * scale;
  return { cw, ch, dw, dh, dx: (cw - dw) / 2, dy: (ch - dh) / 2 };
}

function render() {
  const { cw, ch, dw, dh, dx, dy } = coverParams();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

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

  if (F) tf.draw(ctx, F);
  fx.drawParticles(ctx);
  ctx.restore(); // end shake

  if (F && tf.mask && tf.mask.hud) fx.drawHud(ctx, F, tf.power, cw, ch);

  // capture a clean composite BEFORE the bright flash overlay
  if (pendingCapture) {
    pendingCapture = false;
    canvas.toBlob((blob) => { if (blob) showPhoto(blob); }, 'image/png');
  }

  fx.drawFlash(ctx, cw, ch);

  if (landmarks) {
    if (!faceSeen) { faceSeen = true; if (!tf.active) setStatus(`READY — ${tf.mask.name}に変身`); }
  } else if (!tf.active) {
    faceSeen = false;
    setStatus('顔を画面に合わせてください');
  }

  if (!tf.active && !resetBtn.hidden) resetBtn.hidden = true;
  henshinBtn.disabled = tf.isReleasing;
}

// ---- photo ------------------------------------------------------------------
function takePhoto() {
  sfx.unlock();
  sfx.shutter();
  fx.doFlash(0.6, '255,255,255');
  pendingCapture = true;
}

function showPhoto(blob) {
  if (photoBlob) URL.revokeObjectURL(photoImg.src);
  photoBlob = blob;
  photoImg.src = URL.createObjectURL(blob);
  photoView.hidden = false;
}

async function savePhoto() {
  if (!photoBlob) return;
  const file = new File([photoBlob], `henshin_${Date.now()}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'AR変身カメラ' }); return; }
    catch (e) { /* fall through to download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(photoBlob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---- UI ---------------------------------------------------------------------
startBtn.addEventListener('click', () => { sfx.unlock(); boot(); });
henshinBtn.addEventListener('click', () => {
  sfx.unlock();
  if (tf.isComplete) return;
  tf.start();
  resetBtn.hidden = false;
});
resetBtn.addEventListener('click', () => tf.disengage());
photoBtn.addEventListener('click', takePhoto);
photoSave.addEventListener('click', savePhoto);
photoClose.addEventListener('click', () => { photoView.hidden = true; });
