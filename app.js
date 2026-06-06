import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

import { signs } from "./signs.js";

// ===========================================================================
// 要素参照
// ===========================================================================
const $ = (id) => document.getElementById(id);
const screens = {
  home: $("homeScreen"),
  study: $("studyScreen"),
  result: $("resultScreen"),
};
const els = {
  learnedCount: $("learnedCount"),
  totalCount: $("totalCount"),
  homeBar: $("homeBar"),
  startLessonBtn: $("startLessonBtn"),
  startTestBtn: $("startTestBtn"),

  exitBtn: $("exitBtn"),
  modeChip: $("modeChip"),
  progressText: $("progressText"),
  scoreChip: $("scoreChip"),
  studyBar: $("studyBar"),
  catChip: $("catChip"),
  promptLead: $("promptLead"),
  word: $("word"),
  reading: $("reading"),
  studyControls: $("studyControls"),

  sample: $("sample"),
  sampleSearch: $("sampleSearch"),
  sampleVideo: $("sampleVideo"),
  steps: $("steps"),
  stepsText: $("stepsText"),

  videoWrap: $("videoWrap"),
  video: $("video"),
  overlay: $("overlay"),
  stageMessage: $("stageMessage"),
  fingerReadout: $("fingerReadout"),

  resultEmoji: $("resultEmoji"),
  resultTitle: $("resultTitle"),
  resultScore: $("resultScore"),
  resultRetryBtn: $("resultRetryBtn"),
  resultHomeBtn: $("resultHomeBtn"),
};

// ===========================================================================
// 進捗の保存（おぼえた手話）
// ===========================================================================
const LEARNED_KEY = "shuwa-mirror-learned-words";

function loadLearned() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LEARNED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveLearned(set) {
  localStorage.setItem(LEARNED_KEY, JSON.stringify([...set]));
}
let learned = loadLearned();

function refreshHome() {
  els.totalCount.textContent = signs.length;
  els.learnedCount.textContent = learned.size;
  const pct = Math.round((learned.size / signs.length) * 100);
  els.homeBar.style.width = pct + "%";
}

// ===========================================================================
// 画面切り替え
// ===========================================================================
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ===========================================================================
// お手本動画
// ===========================================================================
function searchUrl(query) {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(query);
}

function setSample(item, show) {
  els.sampleSearch.href = searchUrl(item.search);
  if (!show) {
    els.sampleVideo.innerHTML = ""; // 再生を止める
    return;
  }
  if (item.video) {
    els.sampleVideo.innerHTML =
      `<iframe src="https://www.youtube-nocookie.com/embed/${item.video}?rel=0" ` +
      `title="${item.word} のお手本" loading="lazy" ` +
      `allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" ` +
      `allowfullscreen></iframe>`;
  } else {
    // 動画IDが無い単語は YouTube 検索を開くお手本ボタンにする
    els.sampleVideo.innerHTML =
      `<a class="sample-link" href="${searchUrl(item.search)}" target="_blank" rel="noopener">` +
      `<span class="yt">▶</span><span>お手本動画を見る</span>` +
      `<small>YouTube で「${item.search}」を開く</small></a>`;
  }
}

// ===========================================================================
// カメラ + 手指トラッキング
// ===========================================================================
const ctx = els.overlay.getContext("2d");
let handLandmarker = null;
let drawingUtils = null;
let stream = null;
let rafId = null;
let lastVideoTime = -1;

async function ensureLandmarker() {
  if (handLandmarker) return;
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
}

async function startCamera() {
  if (stream) return;
  els.stageMessage.style.display = "flex";
  els.stageMessage.innerHTML = "<p>📷 カメラを準備しています…</p>";
  try {
    await ensureLandmarker();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 1280 }, facingMode: "user" },
      audio: false,
    });
    els.video.srcObject = stream;
    await els.video.play();
    els.overlay.width = els.video.videoWidth;
    els.overlay.height = els.video.videoHeight;
    els.stageMessage.style.display = "none";
    renderLoop();
  } catch (err) {
    console.error(err);
    const msg =
      err && err.name === "NotAllowedError"
        ? "カメラの使用がきょかされませんでした。<br>ブラウザの設定でカメラをONにしてね。"
        : "カメラまたはモデルの読みこみに失敗しました。<br>ネット接続をたしかめてね。";
    els.stageMessage.innerHTML = `<p>${msg}</p>`;
    els.fingerReadout.textContent = "カメラなしでも、お手本を見て練習できます";
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
  lastVideoTime = -1;
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
}

function renderLoop() {
  rafId = requestAnimationFrame(renderLoop);
  if (!handLandmarker || els.video.readyState < 2) return;
  if (els.video.currentTime !== lastVideoTime) {
    lastVideoTime = els.video.currentTime;
    const result = handLandmarker.detectForVideo(els.video, performance.now());
    drawResult(result);
    updateFingerReadout(result);
  }
}

function drawResult(result) {
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  if (!result.landmarks) return;
  for (const landmarks of result.landmarks) {
    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
      color: "#38c47a",
      lineWidth: 5,
    });
    drawingUtils.drawLandmarks(landmarks, {
      color: "#ff8a3d",
      lineWidth: 1,
      radius: 5,
    });
  }
}

const FINGERS = [
  { name: "親指", tip: 4, pip: 2 },
  { name: "人差し指", tip: 8, pip: 6 },
  { name: "中指", tip: 12, pip: 10 },
  { name: "薬指", tip: 16, pip: 14 },
  { name: "小指", tip: 20, pip: 18 },
];

function countExtended(landmarks) {
  const wrist = landmarks[0];
  let count = 0;
  for (const f of FINGERS) {
    const tip = landmarks[f.tip];
    const pip = landmarks[f.pip];
    let up;
    if (f.name === "親指") {
      const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
      const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
      up = dTip > dPip * 1.1;
    } else {
      up = tip.y < pip.y;
    }
    if (up) count++;
  }
  return count;
}

function updateFingerReadout(result) {
  const hands = result.landmarks || [];
  if (hands.length === 0) {
    els.fingerReadout.textContent = "✋ 手をカメラにうつしてね";
    return;
  }
  const total = hands.reduce((sum, lm) => sum + countExtended(lm), 0);
  const handLabel = hands.length === 2 ? "両手" : "片手";
  els.fingerReadout.textContent = `${handLabel}を けんしゅつ中／指 ${total}本`;
}

// ===========================================================================
// レッスン／テストの進行
// ===========================================================================
const state = {
  mode: "lesson", // 'lesson' | 'test'
  queue: [],
  pos: 0,
  score: 0,
  revealed: false,
};

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startLesson() {
  state.mode = "lesson";
  state.queue = signs.map((_, i) => i);
  state.pos = 0;
  state.score = 0;
  enterStudy();
}

function startTest() {
  state.mode = "test";
  state.queue = shuffled(signs.map((_, i) => i));
  state.pos = 0;
  state.score = 0;
  enterStudy();
}

function enterStudy() {
  showScreen("study");
  startCamera();
  renderStudy();
}

function exitStudy() {
  stopCamera();
  setSample(currentItem(), false); // 動画停止
  refreshHome();
  showScreen("home");
}

function currentItem() {
  return signs[state.queue[state.pos]];
}

function renderStudy() {
  const item = currentItem();
  const isTest = state.mode === "test";

  els.modeChip.textContent = isTest ? "テスト" : "レッスン";
  els.modeChip.classList.toggle("test", isTest);
  els.progressText.textContent = `${state.pos + 1} / ${state.queue.length}`;
  els.studyBar.style.width = Math.round((state.pos / state.queue.length) * 100) + "%";

  els.scoreChip.hidden = !isTest;
  els.scoreChip.textContent = `⭐ ${state.score}`;

  els.catChip.textContent = item.category;
  els.word.textContent = item.word;
  els.reading.textContent = item.reading;
  els.stepsText.textContent = item.steps;

  state.revealed = false;

  if (isTest) {
    // テスト：お手本とヒントは「答えを見る」まで隠す
    els.promptLead.textContent = "この手話を やってみよう";
    els.sample.hidden = true;
    els.steps.hidden = true;
    setSample(item, false);
  } else {
    // レッスン：お手本を見ながら練習
    els.promptLead.textContent = "お手本を見て まねしてみよう";
    els.sample.hidden = false;
    els.steps.hidden = false;
    setSample(item, true);
  }

  renderControls();
}

function renderControls() {
  const c = els.studyControls;
  c.innerHTML = "";

  if (state.mode === "lesson") {
    const back = button("← もどる", "ghost", prevItem);
    if (state.pos === 0) {
      back.disabled = true;
      back.style.opacity = "0.4";
    }
    const last = state.pos === state.queue.length - 1;
    const next = button(last ? "できた！ かんりょう 🎉" : "できた！ つぎへ →", "go", () => {
      learned.add(currentItem().word);
      saveLearned(learned);
      advance();
    });
    c.append(back, next);
  } else {
    if (!state.revealed) {
      c.append(button("お手本を見る 👀", "reveal", revealAnswer));
    } else {
      c.append(
        button("まだ かな △", "maybe", () => grade(false)),
        button("できた！ ◯", "go", () => grade(true))
      );
    }
  }
}

function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.className = "ctrl-btn " + cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function revealAnswer() {
  state.revealed = true;
  els.promptLead.textContent = "答え合わせ：お手本と くらべよう";
  els.sample.hidden = false;
  els.steps.hidden = false;
  setSample(currentItem(), true);
  renderControls();
}

function grade(correct) {
  if (correct) {
    state.score++;
    learned.add(currentItem().word);
    saveLearned(learned);
  }
  setSample(currentItem(), false); // 動画停止
  advance();
}

function prevItem() {
  if (state.pos > 0) {
    state.pos--;
    renderStudy();
  }
}

function advance() {
  state.pos++;
  if (state.pos >= state.queue.length) {
    finishStudy();
  } else {
    renderStudy();
  }
}

function finishStudy() {
  stopCamera();
  setSample(currentItem(), false);
  refreshHome();

  if (state.mode === "lesson") {
    els.resultEmoji.textContent = "🎉";
    els.resultTitle.textContent = "ぜんぶ 見たよ！";
    els.resultScore.innerHTML = `${state.queue.length}この手話を れんしゅうしたよ。<br>つぎは テストで力だめし！`;
  } else {
    const n = state.queue.length;
    const s = state.score;
    const ratio = s / n;
    els.resultEmoji.textContent = ratio === 1 ? "🏆" : ratio >= 0.7 ? "🎉" : "💪";
    els.resultTitle.textContent =
      ratio === 1 ? "ぜんもん せいかい！" : ratio >= 0.7 ? "よくできました！" : "もうすこし！";
    els.resultScore.innerHTML = `スコア：<strong>${s}</strong> / ${n}`;
  }
  showScreen("result");
}

// ===========================================================================
// 配線
// ===========================================================================
els.startLessonBtn.addEventListener("click", startLesson);
els.startTestBtn.addEventListener("click", startTest);
els.exitBtn.addEventListener("click", exitStudy);
els.resultHomeBtn.addEventListener("click", () => {
  refreshHome();
  showScreen("home");
});
els.resultRetryBtn.addEventListener("click", () => {
  state.mode === "test" ? startTest() : startLesson();
});

refreshHome();
