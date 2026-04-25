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

// ---------- PERFORMANCE ADAPTATION ----------
let frameTimeEMA = 16;         // стартовое предположение (60 FPS)
let birdAnimMod = 3;           // текущий интервал смены кадров (по умолчанию 3)

// ---------- RESOURCES ----------
const bg = new Image();
bg.src = "src/bg.png";

const coinImg = new Image();
coinImg.src = "src/coin.png";

// ---------- SOUND ----------
const music = new Audio("src/music.mp3");
music.loop = true;
music.volume = 0.5;

const jumpSound = new Audio("src/jump.mp3");
jumpSound.volume = 1;

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

// ---------- STATE ----------
let bX = 20;
let bY = 150;
let velocity = 0;

let score = 0;
let coinCount = 0;

let gameOver = false;

let pipes = [];
let particles = [];

// ---------- CANVAS FIX ----------
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
cvs.style.display = "block";
cvs.style.touchAction = "none";

function resizeCanvas() {
  const w = 288;
  const h = 512;

  const s = Math.min(window.innerWidth / w, window.innerHeight / h, 1.2);

  cvs.width = w;
  cvs.height = h;

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
    passed: false,
    coinTaken: false
  };
}

function initPipes() {
  pipes = [];
  for (let i = 0; i < 3; i++) {
    pipes.push(createPipe(i * PIPE_DISTANCE));
  }
}

// ---------- PARTICLES ----------
function spawnParticles(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 25
    });
  }
}

// ---------- RESET ----------
function resetGame() {
  bY = 150;
  velocity = 0;
  score = 0;
  coinCount = 0;
  gameOver = false;
  gameState = "play";

  initPipes();
  particles = [];

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
    const snd = jumpSound.cloneNode(true);
    snd.play().catch(() => {});
    snd.addEventListener("ended", () => snd.remove(), { once: true });
    return;
  }

  if (gameState === "gameover" || gameState === "win") {
    resetGame();
    return;
  }

  if (gameState === "play") {
    const snd = jumpSound.cloneNode(true);
    snd.play().catch(() => {});
    snd.addEventListener("ended", () => snd.remove(), { once: true });
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

// ---------- UPDATE (fixed timestep) ----------
function update() {
  birdFrameTick++;
  // Адаптивная смена кадров – интервал зависит от производительности
  if (birdFrameTick % birdAnimMod === 0) {
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

    const coinY = p.topHeight + GAP / 2;
    if (!p.coinTaken) {
      const hit =
        bX < p.x + 24 &&
        bX + BIRD_WIDTH > p.x &&
        bY < coinY + 24 &&
        bY + BIRD_HEIGHT > coinY;
      if (hit) {
        p.coinTaken = true;
        coinCount++;
        spawnParticles(p.x + 12, coinY + 12);
      }
    }
  }

  pipes = pipes.filter(p => p.x + PIPE_WIDTH > -100);

  if (!gameOver) {
    const last = pipes[pipes.length - 1];
    if (!last || last.x < cvs.width - PIPE_DISTANCE) {
      pipes.push(createPipe());
    }
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  }
  particles = particles.filter(p => p.life > 0);

  if (score >= MAX_SCORE) {
    gameState = "win";
    gameOver = true;
  }
}

// ---------- RENDER ----------
function render() {
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  if (bg.complete) {
    ctx.drawImage(bg, 0, 0, cvs.width, cvs.height);
  }

  for (let i = 0; i < pipes.length; i++) {
    const p = pipes[i];
    const bottom = p.topHeight + GAP;

    ctx.fillStyle = "#228B22";
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
    ctx.fillRect(p.x, bottom, PIPE_WIDTH, cvs.height - bottom);

    if (!p.coinTaken && coinImg.complete) {
      const coinY = p.topHeight + GAP / 2;
      ctx.drawImage(coinImg, p.x + 10, coinY, 24, 24);
    }
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.fillStyle = "yellow";
    ctx.fillRect(p.x, p.y, 3, 3);
  }

  drawBird();

  ctx.fillStyle = "#000";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Score: " + score, 10, 10);
  ctx.fillText("Coins: " + coinCount, 10, 35);

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

// ---------- GAME LOOP (производительность + fixed timestep) ----------
function draw(timestamp = 0) {
  if (lastTime === 0) lastTime = timestamp;
  let dt = timestamp - lastTime;
  lastTime = timestamp;

  if (dt > 100) dt = 100;

  // Обновление скользящего среднего времени кадра
  frameTimeEMA = frameTimeEMA * 0.9 + dt * 0.1;

  // Выбор интервала смены кадров на основе измеренной производительности
  if (frameTimeEMA < 18) {
    birdAnimMod = 3;   // отличная производительность
  } else if (frameTimeEMA < 24) {
    birdAnimMod = 5;   // умеренная
  } else {
    birdAnimMod = 7;   // слабое устройство
  }

  if (gameState === "loading" && !assetsLoaded) {
    assetsLoaded =
      bg.complete &&
      coinImg.complete &&
      birdFrames.every(f => f.complete);
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