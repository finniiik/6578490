"use strict";

const cvs = document.getElementById("canvas");
const ctx = cvs.getContext("2d", { alpha: true });
ctx.imageSmoothingEnabled = true;

// ---------- STATE ----------
let gameState = "menu"; // menu -> loading -> play -> gameover/win

// ---------- TIMING ----------
const FIXED_DT = 1000 / 60;
let accumulator = 0;
let lastTime = 0;

let renderAccumulator = 0;
const RENDER_DT = 1000 / 60;

let assetsLoaded = false;

// ---------- DEVICE ----------
const isMobile =
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (window.innerWidth <= 900 && "ontouchstart" in window);

// ---------- BIRD FRAMES (общие настройки) ----------
// На мобильных берём каждый ~3-4й кадр для оптимизации.
const bird1FrameNumbers = isMobile
  ? [1, 4, 7, 10, 13, 16, 19, 22]
  : Array.from({ length: 26 }, (_, i) => i + 1);

const bird2FrameNumbers = isMobile
  ? [1, 4, 7, 10, 13, 16, 19, 22, 25]
  : Array.from({ length: 25 }, (_, i) => i + 1);

const BIRD_ANIM_INTERVAL = isMobile ? 10 : 6;

// ---------- RESOURCES ----------
const bg = new Image();
bg.src = "src/bg.png";

// ---------- SOUND ----------
const music = new Audio("src/music.mp3");
music.loop = true;
music.volume = 0.5;

// Пул звуков для каждой птички отдельно
function makePool(src, size = 3, volume = 1) {
  const pool = [];
  for (let i = 0; i < size; i++) {
    const a = new Audio(src);
    a.volume = volume;
    pool.push(a);
  }
  return pool;
}

const jumpPools = [
  makePool("src/jump.mp3", 3, 1),   // птичка 0
  makePool("src/alisa.mp3", 3, 1),  // птичка 1
];

let lastJumpSoundTime = 0;

function playJumpSound() {
  const now = performance.now();
  if (now - lastJumpSoundTime < 90) return;

  const pool = jumpPools[currentBird] || jumpPools[0];
  for (let a of pool) {
    if (a.paused || a.ended) {
      a.currentTime = 0;
      a.play().catch(() => {});
      lastJumpSoundTime = now;
      return;
    }
  }
}

// ---------- BIRDS (массивы кадров) ----------
function loadFrame(src) {
  const img = new Image();
  // decoding async помогает Safari/iOS быстрее показывать готовые кадры
  try { img.decoding = "async"; } catch (e) {}
  try { img.loading = "eager"; } catch (e) {}
  img.src = src;
  // Принудительный decode — фикс для случаев, когда complete=true,
  // но кадр ещё не отрисовывается (бывает в Chrome/Android и iOS Safari).
  if (img.decode) {
    img.decode().catch(() => {});
  }
  return img;
}

const bird1Frames = [];
for (let n of bird1FrameNumbers) {
  bird1Frames.push(loadFrame(`src/frames/ezgif-frame-${String(n).padStart(3, "0")}-Photoroom.png`));
}

const bird2Frames = [];
for (let n of bird2FrameNumbers) {
  bird2Frames.push(loadFrame(`src/frames2/frame-${String(n).padStart(3, "0")}.png`));
}

// Текущий выбранный персонаж: 0 — первая, 1 — вторая
let currentBird = 0;
let activeFrames = bird1Frames;

let birdFrameIndex = 0;
let birdFrameTick = 0;

function getFrame() {
  const n = activeFrames.length;
  if (!n) return null;
  // Сначала пытаемся показать текущий кадр анимации
  const cur = activeFrames[birdFrameIndex % n];
  if (cur && cur.complete && cur.naturalWidth) return cur;
  // Иначе — любой уже загруженный кадр выбранной птички
  for (let i = 0; i < n; i++) {
    const f = activeFrames[i];
    if (f && f.complete && f.naturalWidth) return f;
  }
  return null;
}

// ---------- SETTINGS ----------
const GAP = 201;
const PIPE_WIDTH = 60;
const PIPE_DISTANCE = 220;

const GRAVITY = 0.45;
const JUMP_FORCE = -7.5;

const BIRD_WIDTH = 55;
const BIRD_HEIGHT = 45;

const MAX_FALL = 7;
const MAX_RISE = -9;

const MAX_SCORE = 67;
const GROUND_HEIGHT = 50;

const MAX_PIPES = 4;

// ---------- STATE ----------
let bX = 20;
let bY = 150;
let velocity = 0;

let score = 0;
let gameOver = false;
let pipes = [];

// ---------- HIGH SCORE (localStorage) ----------
const HS_KEY = "pirobird_highscore";
let highScore = 0;
try {
  const v = parseInt(localStorage.getItem(HS_KEY) || "0", 10);
  if (!isNaN(v)) highScore = v;
} catch (e) {}

function maybeSaveHighScore() {
  if (score > highScore) {
    highScore = score;
    try {
      localStorage.setItem(HS_KEY, String(highScore));
    } catch (e) {}
  }
}

// ---------- CANVAS ----------
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
cvs.style.display = "block";

// ---------- WIN VIDEO ----------
const winVideo = document.createElement("video");
winVideo.src = "src/mzlff.mp4";
winVideo.autoplay = false;
winVideo.loop = true;
winVideo.muted = true;
winVideo.playsInline = true;

winVideo.style.position = "absolute";
winVideo.style.display = "none";
winVideo.style.zIndex = "10";
winVideo.style.objectFit = "cover";
winVideo.style.borderRadius = "12px";

document.body.appendChild(winVideo);

function positionWinVideo() {
  const rect = cvs.getBoundingClientRect();

  const videoWidth = rect.width * 0.75;
  const videoHeight = rect.height * 0.35;

  winVideo.style.width = `${videoWidth}px`;
  winVideo.style.height = `${videoHeight}px`;
  winVideo.style.left = `${rect.left + rect.width * 0.125}px`;
  winVideo.style.top = `${rect.top + rect.height * 0.32}px`;
}

function resizeCanvas() {
  const w = 288;
  const h = 512;
  const dpr = 1;

  cvs.width = w * dpr;
  cvs.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const scale = Math.min(window.innerWidth / w, window.innerHeight / h, 1.5);
  cvs.style.width = w * scale + "px";
  cvs.style.height = h * scale + "px";

  positionWinVideo();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ---------- PIPES ----------
function createPipe(offset = 0) {
  return {
    x: cvs.width + offset,
    topHeight: Math.floor(Math.random() * 180) + 60,
    passed: false
  };
}

function initPipes() {
  pipes.length = 0;
  for (let i = 0; i < 3; i++) {
    pipes.push(createPipe(i * PIPE_DISTANCE));
  }
}

// ---------- RESET ----------
function resetGame() {
  accumulator = 0;
  lastTime = 0;

  bY = 150;
  velocity = 0;
  score = 0;
  gameOver = false;
  gameState = "play";

  initPipes();

  winVideo.pause();
  winVideo.style.display = "none";

  music.currentTime = 0;
  music.play().catch(() => {});
}

// ---------- INPUT ----------
function jump(e) {
  if (e) e.preventDefault();

  // В меню выбора — игнорируем клики по канвасу.
  if (gameState === "menu") return;

  if (gameState === "loading" && !assetsLoaded) return;

  if (gameState === "loading") {
    resetGame();
    velocity = JUMP_FORCE;
    playJumpSound();
    return;
  }

  if (gameState === "gameover") {
    resetGame();
    return;
  }

  if (gameState === "win") {
    resetGame();
    return;
  }

  playJumpSound();
  velocity = JUMP_FORCE;
}

document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault();
    jump(e);
  }
});

cvs.addEventListener("pointerdown", jump);

// ---------- CHARACTER SELECT MENU ----------
const charSelectEl = document.getElementById("char-select");

function selectBird(idx) {
  currentBird = idx;
  activeFrames = idx === 1 ? bird2Frames : bird1Frames;
  birdFrameIndex = 0;
  birdFrameTick = 0;

  if (charSelectEl) charSelectEl.classList.add("hidden");
  // Переходим в loading — клик по канвасу/пробел запустит игру (как раньше).
  gameState = "loading";
}

if (charSelectEl) {
  const cards = charSelectEl.querySelectorAll(".cs-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const idx = parseInt(card.getAttribute("data-bird") || "0", 10);
      selectBird(idx);
    });
  });
}

// ---------- UPDATE ----------
function update() {
  birdFrameTick++;
  if (birdFrameTick >= BIRD_ANIM_INTERVAL) {
    birdFrameTick = 0;
    birdFrameIndex = (birdFrameIndex + 1) % activeFrames.length;
  }

  velocity += GRAVITY;
  velocity = Math.max(Math.min(velocity, MAX_FALL), MAX_RISE);
  bY += velocity;

  if (bY + BIRD_HEIGHT >= cvs.height - GROUND_HEIGHT) {
    gameOver = true;
    gameState = "gameover";
    maybeSaveHighScore();
  }

  for (let i = 0; i < pipes.length; i++) {
    const p = pipes[i];
    p.x -= 1.1;

    const bottom = p.topHeight + GAP;

    if (
      bX + BIRD_WIDTH > p.x &&
      bX < p.x + PIPE_WIDTH &&
      (bY < p.topHeight || bY + BIRD_HEIGHT > bottom)
    ) {
      gameOver = true;
      gameState = "gameover";
      maybeSaveHighScore();
    }

    if (!p.passed && p.x + PIPE_WIDTH < bX) {
      p.passed = true;
      score++;
    }
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    if (pipes[i].x + PIPE_WIDTH < -100) {
      pipes.splice(i, 1);
    }
  }

  if (!gameOver) {
    const last = pipes[pipes.length - 1];
    if (pipes.length < MAX_PIPES && (!last || last.x < cvs.width - PIPE_DISTANCE)) {
      pipes.push(createPipe());
    }
  }

  if (score >= MAX_SCORE) {
    gameState = "win";
    gameOver = true;
    maybeSaveHighScore();
  }
}

// ---------- RENDER ----------
function render() {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  if (bg.complete) {
    ctx.drawImage(bg, 0, 0, cvs.width, cvs.height);
  } else {
    ctx.fillStyle = "#70c5ce";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
  }

  for (let p of pipes) {
    const bottom = p.topHeight + GAP;

    ctx.fillStyle = "#228B22";
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
    ctx.fillRect(p.x, bottom, PIPE_WIDTH, cvs.height - bottom);
  }

  const frame = getFrame();
  if (frame) {
    ctx.drawImage(frame, bX, bY, BIRD_WIDTH, BIRD_HEIGHT);
  }

  ctx.fillStyle = "#000";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Score: " + score, 10, 10);
  ctx.font = "14px Arial";
  ctx.fillText("Best: " + highScore, 10, 34);

  if (gameState === "menu") {
    // Канвас за оверлеем — просто затемним фон.
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
  }

  if (gameState === "loading") {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TAP TO START", cvs.width / 2, cvs.height / 2);
  }

  if (gameState === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VIDEOGAME OVER", cvs.width / 2, cvs.height / 2 - 18);
    ctx.font = "14px Arial";
    ctx.fillText("Score: " + score + "   Best: " + highScore, cvs.width / 2, cvs.height / 2 + 14);
  }

  if (gameState === "win") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    positionWinVideo();

    if (winVideo.style.display === "none") {
      winVideo.style.display = "block";
      winVideo.play().catch(() => {});
    }

    ctx.fillStyle = "#fff";
    ctx.font = "22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("ПОЧЕМУ ИЛЬЯ SHOWS 67", cvs.width / 2, cvs.height * 0.23);

    ctx.font = "14px Arial";
    ctx.fillText("Нажми для рестарта", cvs.width / 2, cvs.height * 0.75);
  }
}

// ---------- LOOP ----------
function draw(t = 0) {
  if (!lastTime) lastTime = t;

  let dt = t - lastTime;
  lastTime = t;

  if (dt > 100) dt = 100;

  if (gameState === "play") {
    accumulator += dt;

    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 2) {
      update();
      accumulator -= FIXED_DT;
      steps++;
    }

    if (steps === 2) accumulator = 0;
  } else {
    accumulator = 0;
  }

  renderAccumulator += dt;
  if (renderAccumulator >= RENDER_DT) {
    render();
    renderAccumulator = 0;
  }

  requestAnimationFrame(draw);
}

bg.onload = () => {
  assetsLoaded = true;
};
// На случай, если bg не загрузится — игра всё равно стартует после выбора.
setTimeout(() => { assetsLoaded = true; }, 1500);

requestAnimationFrame(draw);
