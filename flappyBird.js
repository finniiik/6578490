"use strict";

const cvs = document.getElementById("canvas");
const ctx = cvs.getContext("2d");

// ---------- РЕСУРСЫ ----------
const birdVideo = document.createElement("video");
birdVideo.src = "src/bird.webm";
birdVideo.loop = true;
birdVideo.muted = true;
birdVideo.playsInline = true;
birdVideo.play();

const bg = new Image();
bg.src = "src/bg.png";

// 🔊 ЗВУКИ
const music = new Audio("src/music.mp3");
music.loop = true;
music.volume = 0.5;

const jumpSound = new Audio("src/jump.mp3");
jumpSound.volume = 1;

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

// ---------- МОБИЛКА FIX ----------
document.body.style.overflow = "hidden";

// ---------- АДАПТАЦИЯ ----------
function resizeCanvas() {
const scale = Math.min(window.innerWidth / 288, 1.2);

cvs.width = 288;
cvs.height = 512;

cvs.style.width = `${288 * scale}px`;
cvs.style.height = `${512 * scale}px`;
}
window.addEventListener("resize", resizeCanvas);
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
birdVideo.play();

music.currentTime = 0;
music.play();

if (!animationFrameId) {
animationFrameId = requestAnimationFrame(draw);
}
}

// ---------- ПРЫЖОК ----------
function jump(e) {
e.preventDefault();

// звук всегда заново
jumpSound.currentTime = 0;
jumpSound.play();

if (gameOver) {
resetGame();
return;
}

velocity = JUMP_FORCE;
}

document.addEventListener("keydown", (e) => {
if (e.code === "Space") jump(e);
});

cvs.addEventListener("click", jump);
cvs.addEventListener("touchstart", jump, { passive: false });

// ---------- СТАРТ ----------
function startGame() {
initPipes();
music.play();

if (!animationFrameId) {
animationFrameId = requestAnimationFrame(draw);
}
}

bg.onload = startGame;

// ---------- DRAW ----------
function draw() {

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
ctx.drawImage(birdVideo, bX, bY, BIRD_WIDTH, BIRD_HEIGHT);

// земля
ctx.fillStyle = "#8B4513";
ctx.fillRect(0, cvs.height - 50, cvs.width, 50);

// SCORE (чёрный)
ctx.fillStyle = "#000";
ctx.font = "20px Arial";
ctx.textAlign = "left";
ctx.fillText("Score: " + score, 15, 25);

// ПОБЕДА
if (score >= MAX_SCORE) {
ctx.fillStyle = "rgba(0,0,0,0.7)";
ctx.fillRect(0, cvs.height / 2 - 40, cvs.width, 80);

ctx.fillStyle = "#fff";
ctx.textAlign = "center";
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
ctx.font = "24px Arial";
ctx.fillText("GAME OVER", cvs.width / 2, cvs.height / 2);
ctx.font = "14px Arial";
ctx.fillText("tap or space", cvs.width / 2, cvs.height / 2 + 25);
}

animationFrameId = requestAnimationFrame(draw);
}
