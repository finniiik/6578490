"use strict";

"use strict";

const cvs = document.getElementById("canvas");
const ctx = cvs.getContext("2d", { alpha: true });

// ---------- РЕСУРСЫ ----------
const birdVideo = document.createElement("video");
birdVideo.src = "src/bird.webm";
birdVideo.loop = true;
birdVideo.muted = true;
birdVideo.playsInline = true;
birdVideo.setAttribute("playsinline", "");
birdVideo.preload = "auto";
birdVideo.play().catch(() => {});

const bg = new Image();
bg.src = "src/bg.png";

// 🔊 ЗВУКИ
const music = new Audio("src/music.mp3");
music.loop = true;
music.volume = 0.5;
music.preload = "auto";

const jumpSound = new Audio("src/jump.mp3");
jumpSound.volume = 1;
jumpSound.preload = "auto";

// ---------- НАСТРОЙКИ ----------
const GAP = 200;
const PIPE_WIDTH = 60;

const GRAVITY = 0.45;
const JUMP_FORCE = -7.5;

const PIPE_SPEED = 1.1;
const PIPE_DISTANCE = 220;

const BIRD_WIDTH = 55;
const BIRD_HEIGHT = 55;

const MAX_FALL = 7;
const MAX_RISE = -9;

const MAX_SCORE = 67;

// ---------- СОСТОЯНИЕ ----------
let bX = 20;
let bY = 150;
let velocity = 0;

let score = 0;
let gameOver = false;
let pipes = [];

let animationFrameId = null;
let gameStarted = false;

let isMobile = false;

// ---------- MOBILЕ BLACK-FIX BUFFER ----------
const birdBuffer = document.createElement("canvas");
birdBuffer.width = BIRD_WIDTH;
birdBuffer.height = BIRD_HEIGHT;
const birdBufferCtx = birdBuffer.getContext("2d", { willReadFrequently: true });

// ---------- МОБИЛКА FIX ----------
document.body.style.overflow = "hidden";
cvs.style.touchAction = "none";

// ---------- АДАПТАЦИЯ ----------
function updateDeviceMode() {
isMobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900;
}

function resizeCanvas() {
updateDeviceMode();

const baseWidth = 288;
const baseHeight = 512;

const scale = isMobile
? Math.max(window.innerWidth / baseWidth, window.innerHeight / baseHeight)
: Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight, 1.2);

cvs.width = baseWidth;
cvs.height = baseHeight;

cvs.style.width = `${Math.round(baseWidth * scale)}px`;
cvs.style.height = `${Math.round(baseHeight * scale)}px`;
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
resizeCanvas();

// ---------- ТРУБЫ ----------
function createPipe(offset = 0) {
return {
x: cvs.width + offset,
topHeight: Math.floor(Math.random() * 180) + 60,
passed: false
};
}

function initPipes() {
pipes = [];
for (let i = 0; i < 3; i++) {
pipes.push(createPipe(i * PIPE_DISTANCE));
}
}

// ---------- СБРОС ----------
function resetGame() {
bY = 150;
velocity = 0;
score = 0;
gameOver = false;

initPipes();

birdVideo.currentTime = 0;
birdVideo.play().catch(() => {});

music.currentTime = 0;
music.play().catch(() => {});
}

// ---------- ЗВУК ПРЫЖКА ----------
function playJumpSound() {
const s = jumpSound.cloneNode(true);
s.volume = jumpSound.volume;
s.play().catch(() => {});
}

// ---------- СТАРТ ----------
function startGame() {
if (gameStarted) return;

gameStarted = true;
initPipes();

music.play().catch(() => {});

if (!animationFrameId) {
animationFrameId = requestAnimationFrame(draw);
}
}

bg.onload = startGame;

// ---------- ПРЫЖОК ----------
function jump(e) {
if (e) e.preventDefault();

if (!gameStarted) {
startGame();
}

if (gameOver) {
resetGame();
return;
}

playJumpSound();
velocity = JUMP_FORCE;
}

document.addEventListener("keydown", (e) => {
if (e.code === "Space") {
e.preventDefault();
jump(e);
}
});

cvs.addEventListener("pointerdown", jump, { passive: false });

// ---------- РИСОВАНИЕ ПТИЦЫ ----------
function drawBird() {
if (isMobile) {
birdBufferCtx.clearRect(0, 0, BIRD_WIDTH, BIRD_HEIGHT);
birdBufferCtx.drawImage(birdVideo, 0, 0, BIRD_WIDTH, BIRD_HEIGHT);

const frame = birdBufferCtx.getImageData(0, 0, BIRD_WIDTH, BIRD_HEIGHT);
const d = frame.data;

for (let i = 0; i < d.length; i += 4) {
if (d[i] <= 12 && d[i + 1] <= 12 && d[i + 2] <= 12) {
d[i + 3] = 0;
}
}

ctx.putImageData(frame, Math.round(bX), Math.round(bY));
return;
}

ctx.drawImage(birdVideo, bX, bY, BIRD_WIDTH, BIRD_HEIGHT);
}

// ---------- DRAW ----------
function draw() {
ctx.clearRect(0, 0, cvs.width, cvs.height);

// фон
if (bg.complete) {
ctx.drawImage(bg, 0, 0, cvs.width, cvs.height);
} else {
ctx.fillStyle = "#70c5ce";
ctx.fillRect(0, 0, cvs.width, cvs.height);
}

// трубы
for (let i = 0; i < pipes.length; i++) {
const p = pipes[i];
const bottom = p.topHeight + GAP;

ctx.fillStyle = "#228B22";
ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
ctx.fillRect(p.x, bottom, PIPE_WIDTH, cvs.height - bottom);

if (!gameOver) {
p.x -= PIPE_SPEED;

const birdRight = bX + BIRD_WIDTH;
const birdBottom = bY + BIRD_HEIGHT;

if (
birdRight > p.x &&
bX < p.x + PIPE_WIDTH &&
(bY < p.topHeight || birdBottom > bottom)
) {
gameOver = true;
}

if (birdBottom > cvs.height - 50) {
gameOver = true;
}

if (!p.passed && p.x + PIPE_WIDTH < bX) {
p.passed = true;
score++;
}

if (p.x + PIPE_WIDTH < 0) {
pipes.splice(i, 1);
i--;
}
}
}

// спавн
if (!gameOver) {
const last = pipes[pipes.length - 1];
if (last && last.x < cvs.width - PIPE_DISTANCE) {
pipes.push(createPipe());
}
}

// физика
if (!gameOver) {
velocity += GRAVITY;

if (velocity > MAX_FALL) velocity = MAX_FALL;
if (velocity < MAX_RISE) velocity = MAX_RISE;

bY += velocity;
}

// птица
if (birdVideo.readyState >= 2) {
drawBird();
}

// земля
ctx.fillStyle = "#8B4513";
ctx.fillRect(0, cvs.height - 50, cvs.width, 50);

// SCORE
ctx.fillStyle = "#000";
ctx.font = "20px Arial";
ctx.textAlign = "left";
ctx.textBaseline = "top";
ctx.fillText("Score: " + score, 10, 30);

// ПОБЕДА
if (score >= MAX_SCORE) {
ctx.fillStyle = "rgba(0,0,0,0.7)";
ctx.fillRect(0, cvs.height / 2 - 40, cvs.width, 80);

ctx.fillStyle = "#fff";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font = "20px Arial";
ctx.fillText("ПОЧЕМУ ИЛЬЯ SHOWS 67", cvs.width / 2, cvs.height / 2);

gameOver = true;
}

// GAME OVER
if (gameOver && score < MAX_SCORE) {
ctx.fillStyle = "rgba(0,0,0,0.6)";
ctx.fillRect(0, cvs.height / 2 - 40, cvs.width, 80);

ctx.fillStyle = "#fff";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font = "24px Arial";
ctx.fillText("GAME OVER", cvs.width / 2, cvs.height / 2);

ctx.font = "14px Arial";
ctx.fillText("tap or space", cvs.width / 2, cvs.height / 2 + 25);
}

animationFrameId = requestAnimationFrame(draw);
}