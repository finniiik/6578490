"use strict";

const cvs = document.getElementById("canvas");
const ctx = cvs.getContext("2d", { alpha: true });

// ---------- STATE ----------
let gameState = "loading"; // loading | play | gameover | win

// ---------- FIXED TIMESTEP ----------
const FIXED_DT = 1000 / 60; // 16.67 ms
let accumulator = 0;
let lastTime = 0;
let assetsLoaded = false;

// ---------- RESOURCES ----------
const bg = new Image();
bg.src = "src/bg.png";

// (монеты полностью отключены – coinImg не загружаем)

// ---------- SOUND ----------
const music = new Audio("src/music.mp3");
music.loop = true;
music.volume = 0.5;

const jumpSound = new Audio("src/jump.mp3");
jumpSound.volume = 1;

// ---------- AUDIO POOL (прыжок) ----------
const JUMP_POOL_SIZE = 4;
const jumpAudioPool = [];
for (let i = 0; i < JUMP_POOL_SIZE; i++) {
  const audio = new Audio(jumpSound.src);
  audio.volume = jumpSound.volume;
  jumpAudioPool.push(audio);
}
let lastJumpSoundTime = 0;
const JUMP_SOUND_COOLDOWN = 100; // увеличенный cooldown для мобильных

function playJumpSound() {
  const now = performance.now();
  if (now - lastJumpSoundTime < JUMP_SOUND_COOLDOWN) return;

  for (let i = 0; i < jumpAudioPool.length; i++) {
    const audio = jumpAudioPool[i];
    if (audio.paused || audio.ended) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      lastJumpSoundTime = now;
      return;
    }
  }
  // все заняты – не накапливаем
}

// ---------- BIRD SPRITES ----------
const birdFrames = [];
let birdFrameIndex = 0;
let birdFrameTick = 0;

for (let i = 1; i <= 26; i++) {
  const img = new Image();
  const num = String(i).padStart(3, "0");
  img.src = `src/frames/ezgif-frame-${num}-Photoroom.png`;
  birdFrames.push(img);
}

// ---------- SETTINGS ----------
const GAP = 201;
const PIPE_WIDTH = 60;

const GRAVITY = 0.45;
const JUMP_FORCE = -7.5;

const PIPE_SPEED = 1.1;
const PIPE_DISTANCE = 220;

const BIRD_WIDTH = 55;
const BIRD_HEIGHT = 45;

const MAX_FALL = 7;
const MAX_RISE = -9;

const MAX_SCORE = 67;

const GROUND_HEIGHT = 50;

// ---------- УПРОЩЁННАЯ АНИМАЦИЯ ----------
const BIRD_ANIM_INTERVAL = 6;   // смена кадра каждые 6 тиков (было 4)

// ---------- STATE ----------
let bX = 20;
let bY = 150;
let velocity = 0;

let score = 0;
// coinCount полностью удалён

let gameOver = false;

let pipes = [];
// particles массив полностью удалён

// ---------- CANVAS FIX / RETINA OFF ----------
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
cvs.style.display = "block";
cvs.style.touchAction = "none";

function resizeCanvas() {
  const w = 288;
  const h = 512;
  const dpr = 1;  // принудительно 1x, без retina-нагрузки

  cvs.width = w * dpr;
  cvs.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const s = Math.min(window.innerWidth / w, window.innerHeight / h, 1.2);
  cvs.style.width = w * s + "px";
  cvs.style.height = h * s + "px";
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ---------- PIPE ----------
function createPipe(offset = 0) {
  return {
    x: cvs.width + offset,
    topHeight: Math.floor(Math.random() * 180) + 60,
    passed: false
    // coinTaken удалён
  };
}

function initPipes() {
  pipes = [];
  for (let i = 0; i < 3; i++) {
    pipes.push(createPipe(i * PIPE_DISTANCE));
  }
}

// ---------- RESET ----------
function resetGame() {
  bY = 150;
  velocity = 0;
  score = 0;
  gameOver = false;
  gameState = "play";

  initPipes();

  music.currentTime = 0;
  music.play().catch(() => {});
}

// ---------- INPUT ----------
function jump(e) {
  if (e) e.preventDefault();

  if (gameState === "loading" && !assetsLoaded) return;

  if (gameState === "loading" && assetsLoaded) {
    resetGame();
    velocity = JUMP_FORCE;
    playJumpSound();
    return;
  }

  if (gameState === "gameover" || gameState === "win") {
    resetGame();
    return;
  }

  if (gameState === "play") {
    playJumpSound();
    velocity = JUMP_FORCE;
  }
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    jump(e);
  }
});

cvs.addEventListener("pointerdown", jump, { passive: false });

// ---------- BIRD ----------
function drawBird() {
  const frame = birdFrames[birdFrameIndex];
  if (frame && frame.complete) {
    ctx.drawImage(frame, bX, bY, BIRD_WIDTH, BIRD_HEIGHT);
  } else {
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(bX, bY, BIRD_WIDTH, BIRD_HEIGHT);
  }
}

// ---------- UPDATE (без частиц и монет) ----------
function update() {
  birdFrameTick++;
  if (birdFrameTick % BIRD_ANIM_INTERVAL === 0) {
    birdFrameIndex = (birdFrameIndex + 1) % birdFrames.length;
  }

  velocity += GRAVITY;
  if (velocity > MAX_FALL) velocity = MAX_FALL;
  if (velocity < MAX_RISE) velocity = MAX_RISE;
  bY += velocity;

  if (!isFinite(bY) || !isFinite(velocity)) {
    bY = 150;
    velocity = 0;
  }

  if (bY + BIRD_HEIGHT >= cvs.height - GROUND_HEIGHT) {
    gameOver = true;
    gameState = "gameover";
  }

  for (let i = 0; i < pipes.length; i++) {
    const p = pipes[i];
    p.x -= PIPE_SPEED;

    const right = bX + BIRD_WIDTH;
    const bot = bY + BIRD_HEIGHT;
    const bottom = p.topHeight + GAP;

    if (
      right > p.x &&
      bX < p.x + PIPE_WIDTH &&
      (bY < p.topHeight || bot > bottom)
    ) {
      gameOver = true;
      gameState = "gameover";
    }

    if (!p.passed && p.x + PIPE_WIDTH < bX) {
      p.passed = true;
      score++;
    }
    // логика монет полностью удалена
  }

  pipes = pipes.filter(p => p.x + PIPE_WIDTH > -100);

  if (!gameOver) {
    const last = pipes[pipes.length - 1];
    if (!last || last.x < cvs.width - PIPE_DISTANCE) {
      pipes.push(createPipe());
    }
  }

  // массив particles больше не обновляется и не существует

  if (score >= MAX_SCORE) {
    gameState = "win";
    gameOver = true;
  }
}

// ---------- RENDER (без clearRect, без частиц, без монет) ----------
function render() {
  // фон рисуется первым и перекрывает всё — clearRect не нужен
  if (bg.complete) {
    ctx.drawImage(bg, 0, 0, cvs.width, cvs.height);
  }

  for (let i = 0; i < pipes.length; i++) {
    const p = pipes[i];
    const bottom = p.topHeight + GAP;

    ctx.fillStyle = "#228B22";
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
    ctx.fillRect(p.x, bottom, PIPE_WIDTH, cvs.height - bottom);

    // отрисовка монет удалена
  }

  // отрисовка частиц удалена

  drawBird();

  ctx.fillStyle = "#000";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Score: " + score, 10, 10);
  // счётчик монет убран

  if (gameState === "loading") {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "22px Arial";
    if (!assetsLoaded) {
      ctx.fillText("LOADING...", cvs.width / 2, cvs.height / 2 - 20);
    } else {
      ctx.fillText("пироберд", cvs.width / 2, cvs.height / 2 - 20);
      ctx.font = "14px Arial";
      ctx.fillText("клацай или пкм по любому месту", cvs.width / 2, cvs.height / 2 + 20);
    }
  }

  if (gameState === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "28px Arial";
    ctx.fillText("GAME OVER", cvs.width / 2, cvs.height / 2);
  }

  if (gameState === "win") {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "22px Arial";
    ctx.fillText("ПОЧЕМУ ИЛЬЯ SHOWS 67", cvs.width / 2, cvs.height / 2);
  }
}

// ---------- GAME LOOP (dt ограничен) ----------
function draw(timestamp = 0) {
  if (lastTime === 0) lastTime = timestamp;
  let dt = timestamp - lastTime;
  lastTime = timestamp;

  if (dt > 100) dt = 100; // защита от вылетов (уже было)

  if (gameState === "loading" && !assetsLoaded) {
    assetsLoaded =
      bg.complete && birdFrames.every(f => f.complete); // coinImg больше нет
  }

  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < 5) {
    if (gameState === "play") {
      update();
    }
    accumulator -= FIXED_DT;
    steps++;
  }

  render();
  requestAnimationFrame(draw);
}

// ---------- ЗАПУСК ----------
requestAnimationFrame(draw);