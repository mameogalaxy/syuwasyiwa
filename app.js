import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

import { fingerspelling } from "./fingerspelling.js";

const els = {
  videoWrap: document.getElementById("videoWrap"),
  video: document.getElementById("video"),
  overlay: document.getElementById("overlay"),
  stageMessage: document.getElementById("stageMessage"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  snapshotBtn: document.getElementById("snapshotBtn"),
  mirrorToggle: document.getElementById("mirrorToggle"),
  landmarkToggle: document.getElementById("landmarkToggle"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  charGrid: document.getElementById("charGrid"),
  charDetail: document.getElementById("charDetail"),
  detailGlyph: document.getElementById("detailGlyph"),
  detailReading: document.getElementById("detailReading"),
  detailDesc: document.getElementById("detailDesc"),
  practiceBox: document.getElementById("practiceBox"),
  handStats: document.getElementById("handStats"),
};

const ctx = els.overlay.getContext("2d");
let handLandmarker = null;
let drawingUtils = null;
let stream = null;
let rafId = null;
let lastVideoTime = -1;

// ---- Status helpers -------------------------------------------------------

function setStatus(text, state = "") {
  els.statusText.textContent = text;
  els.statusDot.className = "status-dot" + (state ? " " + state : "");
}

// ---- Fingerspelling reference UI -----------------------------------------

function buildCharGrid() {
  fingerspelling.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.className = "char-btn";
    btn.textContent = item.char;
    btn.setAttribute("aria-label", `${item.char} (${item.reading})`);
    btn.addEventListener("click", () => selectChar(index, btn));
    els.charGrid.appendChild(btn);
  });
}

function selectChar(index, btn) {
  document
    .querySelectorAll(".char-btn.active")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  const item = fingerspelling[index];
  els.detailGlyph.textContent = item.char;
  els.detailReading.textContent = `${item.char}（${item.reading}）`;
  els.detailDesc.textContent = item.desc;
  els.charDetail.hidden = false;
}

// ---- MediaPipe setup ------------------------------------------------------

async function ensureLandmarker() {
  if (handLandmarker) return handLandmarker;
  setStatus("手指トラッキングを読み込み中…", "loading");

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  });

  drawingUtils = new DrawingUtils(ctx);
  return handLandmarker;
}

// ---- Camera ---------------------------------------------------------------

async function startCamera() {
  els.startBtn.disabled = true;
  try {
    await ensureLandmarker();
    setStatus("カメラへのアクセスを許可してください…", "loading");

    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" },
      audio: false,
    });

    els.video.srcObject = stream;
    await els.video.play();

    els.overlay.width = els.video.videoWidth;
    els.overlay.height = els.video.videoHeight;

    els.stageMessage.style.display = "none";
    els.stopBtn.disabled = false;
    els.snapshotBtn.disabled = false;
    els.practiceBox.hidden = false;
    setStatus("ライブ中 — 手をカメラに向けてみましょう", "live");

    renderLoop();
  } catch (err) {
    console.error(err);
    els.startBtn.disabled = false;
    const msg =
      err && err.name === "NotAllowedError"
        ? "カメラの使用が許可されませんでした。"
        : "カメラまたはモデルの読み込みに失敗しました。";
    setStatus(msg, "error");
  }
}

function stopCamera() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  els.video.srcObject = null;
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  els.stageMessage.style.display = "flex";
  els.startBtn.disabled = false;
  els.stopBtn.disabled = true;
  els.snapshotBtn.disabled = true;
  els.practiceBox.hidden = true;
  lastVideoTime = -1;
  setStatus("停止しました", "");
}

// ---- Detection loop -------------------------------------------------------

function renderLoop() {
  rafId = requestAnimationFrame(renderLoop);
  if (!handLandmarker || els.video.readyState < 2) return;

  if (els.video.currentTime !== lastVideoTime) {
    lastVideoTime = els.video.currentTime;
    const result = handLandmarker.detectForVideo(els.video, performance.now());
    drawResult(result);
    updateHandStats(result);
  }
}

function drawResult(result) {
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  if (!els.landmarkToggle.checked || !result.landmarks) return;

  for (const landmarks of result.landmarks) {
    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
      color: "#36d1a6",
      lineWidth: 4,
    });
    drawingUtils.drawLandmarks(landmarks, {
      color: "#4f8cff",
      lineWidth: 1,
      radius: 4,
    });
  }
}

// ---- Hand statistics (extended-finger count) ------------------------------

const FINGERS = [
  { name: "親指", tip: 4, pip: 2 },
  { name: "人差し指", tip: 8, pip: 6 },
  { name: "中指", tip: 12, pip: 10 },
  { name: "薬指", tip: 16, pip: 14 },
  { name: "小指", tip: 20, pip: 18 },
];

function countExtendedFingers(landmarks) {
  const wrist = landmarks[0];
  let count = 0;
  const extended = [];
  for (const f of FINGERS) {
    const tip = landmarks[f.tip];
    const pip = landmarks[f.pip];
    let isUp;
    if (f.name === "親指") {
      // 親指は手首からの距離で開閉を推定（向きに依存しにくい）。
      const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
      const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
      isUp = dTip > dPip * 1.1;
    } else {
      // 指先がPIP関節より上（y小さい）なら伸びていると判定。
      isUp = tip.y < pip.y;
    }
    if (isUp) {
      count++;
      extended.push(f.name);
    }
  }
  return { count, extended };
}

function updateHandStats(result) {
  const hands = result.landmarks || [];
  if (hands.length === 0) {
    els.handStats.innerHTML = "<li>手は検出されていません。</li>";
    return;
  }

  const rows = hands.map((landmarks, i) => {
    const label = result.handedness?.[i]?.[0]?.categoryName === "Left" ? "左手" : "右手";
    const { count, extended } = countExtendedFingers(landmarks);
    const detail = extended.length ? extended.join("・") : "握り";
    return `<li class="hand-row"><span>${label}</span><span class="fingers">${count}本 (${detail})</span></li>`;
  });

  els.handStats.innerHTML = rows.join("");
}

// ---- Snapshot -------------------------------------------------------------

function takeSnapshot() {
  const w = els.video.videoWidth;
  const h = els.video.videoHeight;
  if (!w || !h) return;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");

  if (els.mirrorToggle.checked) {
    c.translate(w, 0);
    c.scale(-1, 1);
  }
  c.drawImage(els.video, 0, 0, w, h);
  if (els.landmarkToggle.checked) {
    c.drawImage(els.overlay, 0, 0, w, h);
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `shuwa-mirror-${stamp}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ---- Mirror toggle --------------------------------------------------------

function applyMirror() {
  els.videoWrap.classList.toggle("mirrored", els.mirrorToggle.checked);
}

// ---- Wire up --------------------------------------------------------------

els.startBtn.addEventListener("click", startCamera);
els.stopBtn.addEventListener("click", stopCamera);
els.snapshotBtn.addEventListener("click", takeSnapshot);
els.mirrorToggle.addEventListener("change", applyMirror);

buildCharGrid();
applyMirror();

if (!navigator.mediaDevices?.getUserMedia) {
  setStatus("このブラウザはカメラに対応していません。", "error");
  els.startBtn.disabled = true;
}
