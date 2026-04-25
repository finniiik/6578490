"use strict";

const cvs = document.getElementById("canvas");
const ctx = cvs.getContext("2d", { alpha: true });
ctx.imageSmoothingEnabled = true;

// ---------- STATE ----------
let gameState = "loading"; // loading | play | gameover | win

// ---------- TIMING ----------
const FIXED_DT = 1000 / 60;
let accumulator = 0;
let lastTime = 0;
let assetsLoaded = false;

// ---------- DEVICE MODE ----------
const isMobile =
window.matchMedia("(pointer: coarse)").matches ||
/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// На мобилке грузим меньше кадров птицы.
const birdFrameNumbers = isMobile
? [1, 4, 7, 10, 13, 16, 19, 22]
: Array.from({ length: 26 }, (_, i) => i + 1);

const BIRD_ANIM_INTERVAL = isMobile ? 10 : 6;
const MAX_PIPES = 4;

// ---------- RESOURCES ----------
const bg = new Image();
bg.src = "src/bg.png";

// ---------- SOUND ----------
const music = new Audio("src/music.mp3");
music.loop = true;
music.volume = 0.5;
music.preload = "auto";

const jumpSoundSrc = "src/jump.mp3";
const JUMP_POOL_SIZE = 3;
const jumpAudioPool = [];

for (let i = 0; i < JUMP_POOL_SIZE; i++) {
const audio = new Audio(jumpSoundSrc);
audio.volume = 1;
audio.preload = "auto";
jumpAudioPool.push(audio);
}

let lastJumpSoundTime = 0;
const JUMP_SOUND_COOLDOWN = 90;

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
}

// ---------- BIRD SPRITES ----------
const birdFrames = [];
let birdFrameIndex = 0;
let birdFrameTick = 0;

for (const n of birdFrameNumbers) {
const img = new Image();
const num = String(n).padStart(3, "0");
img.src = `src/frames/ezgif-frame-${num}-Photoroom.png`;
birdFrames.push(img);
}

function getLoadedBirdFrame() {
for (let i = 0; i < birdFrames.length; i++) {
const frame = birdFrames[(birdFrameIndex + i) % birdFrames.length];
if (frame && frame.complete && frame.naturalWidth > 0) {
return frame;
}
}
return null;
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

// ---------- GAME STATE ----------
let bX = 20;
let bY = 150;
let velocity = 0;

let score = 0;
let gameOver = false;
let pipes = [];

// ---------- CANVAS ----------
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
cvs.style.display = "block";
cvs.style.touchAction = "none";

function resizeCanvas() {
const w = 288;
const h = 512;

// Без retina-нагрузки на iPhone.
const dpr = 1;

cvs.width = w * dpr;
cvs.height = h * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const scale = isMobile
? Math.max(window.innerWidth / w, window.innerHeight / h)
: Math.min(window.innerWidth / w, window.innerHeight / h, 1.2);

cvs.style.width = `${Math.round(w * scale)}px`;
cvs.style.height = `${Math.round(h * scale)}px`;
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
resizeCanvas();

// ---------- PIPE ----------
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
lastTime = 0;
accumulator = 0;

bX = 20;
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
const frame = getLoadedBirdFrame();

if (frame) {
ctx.drawImage(frame, bX, bY, BIRD_WIDTH, BIRD_HEIGHT);
} else {
ctx.fillStyle = "#FFD700";
ctx.fillRect(bX, bY, BIRD_WIDTH, BIRD_HEIGHT);
}
}

// ---------- UPDATE ----------
function update() {
birdFrameTick++;
if (birdFrameTick >= BIRD_ANIM_INTERVAL) {
birdFrameTick = 0;
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
}

// Быстрая чистка без filter() каждый кадр.
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
}
}

// ---------- RENDER ----------
function render() {
if (bg.complete && bg.naturalWidth > 0) {
ctx.drawImage(bg, 0, 0, cvs.width, cvs.height);
} else {
ctx.fillStyle = "#70c5ce";
ctx.fillRect(0, 0, cvs.width, cvs.height);
}

for (let i = 0; i < pipes.length; i++) {
const p = pipes[i];
const bottom = p.topHeight + GAP;

ctx.fillStyle = "#228B22";
ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
ctx.fillRect(p.x, bottom, PIPE_WIDTH, cvs.height - bottom);
}

drawBird();

ctx.fillStyle = "#000";
ctx.font = "20px Arial";
ctx.textAlign = "left";
ctx.textBaseline = "top";
ctx.fillText("Score: " + score, 10, 10);

if (gameState === "loading") {
ctx.fillStyle = "rgba(0,0,0,0.85)";
ctx.fillRect(0, 0, cvs.width, cvs.height);

ctx.fillStyle = "#fff";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
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
ctx.textBaseline = "middle";
ctx.font = "28px Arial";
ctx.fillText("GAME OVER", cvs.width / 2, cvs.height / 2);
}

if (gameState === "win") {
ctx.fillStyle = "rgba(0,0,0,0.8)";
ctx.fillRect(0, 0, cvs.width, cvs.height);

ctx.fillStyle = "#fff";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font = "22px Arial";
ctx.fillText("ПОЧЕМУ ИЛЬЯ SHOWS 67", cvs.width / 2, cvs.height / 2);
}
}

// ---------- LOOP ----------
function draw(timestamp = 0) {
if (lastTime === 0) lastTime = timestamp;

let dt = timestamp - lastTime;
lastTime = timestamp;

if (dt > 100) dt = 100;

// Пока loading / gameover / win — не копим лаг в аккумулятор.
if (gameState !== "play") {
accumulator = 0;
} else {
accumulator += dt;

let steps = 0;
while (accumulator >= FIXED_DT && steps < 3) {
update();
accumulator -= FIXED_DT;
steps++;
}

if (steps === 3) {
accumulator = 0;
}
}

render();
requestAnimationFrame(draw);
}

// ---------- ASSET LOAD ----------
bg.onload = () => {
assetsLoaded = true;
};

requestAnimationFrame(draw);