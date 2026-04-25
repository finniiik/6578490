"use strict";

const cvs = document.getElementById("canvas");
const ctx = cvs.getContext("2d", { alpha: true });
ctx.imageSmoothingEnabled = true;

// ---------- STATE ----------
let gameState = "loading";

// ---------- TIMING ----------
const FIXED_DT = 1000 / 60;
let accumulator = 0;
let lastTime = 0;

let assetsLoaded = false;

// ---------- DEVICE ----------
const isMobile =
/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
(window.innerWidth <= 900 && "ontouchstart" in window);

// ---------- BIRD FRAMES ----------
const birdFrameNumbers = isMobile
? [1, 4, 7, 10, 13, 16, 19, 22]
: Array.from({ length: 26 }, (_, i) => i + 1);

const BIRD_ANIM_INTERVAL = isMobile ? 10 : 6;

// ---------- RESOURCES ----------
const bg = new Image();
bg.src = "src/bg.png";

// ---------- SOUND ----------
const music = new Audio("src/music.mp3");
music.loop = true;
music.volume = 0.5;

const jumpAudioPool = [];
for (let i = 0; i < 3; i++) {
const a = new Audio("src/jump.mp3");
a.volume = 1;
jumpAudioPool.push(a);
}

let lastJumpSoundTime = 0;

function playJumpSound() {
const now = performance.now();
if (now - lastJumpSoundTime < 90) return;

for (let a of jumpAudioPool) {
if (a.paused || a.ended) {
a.currentTime = 0;
a.play().catch(() => {});
lastJumpSoundTime = now;
return;
}
}
}

// ---------- BIRD ----------
const birdFrames = [];
let birdFrameIndex = 0;
let birdFrameTick = 0;

for (let n of birdFrameNumbers) {
const img = new Image();
img.src = `src/frames/ezgif-frame-${String(n).padStart(3, "0")}-Photoroom.png`;
birdFrames.push(img);
}

function getFrame() {
const f = birdFrames[birdFrameIndex];
return f && f.complete && f.naturalWidth ? f : null;
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
let prevBY = bY;
let velocity = 0;

let score = 0;
let gameOver = false;
let pipes = [];

// ---------- CANVAS ----------
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
cvs.style.display = "block";

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
prevBY = bY;
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

if (gameState !== "play") {
resetGame();
return;
}

playJumpSound();
velocity = JUMP_FORCE;
}

document.addEventListener("keydown", e => {
if (e.code === "Space") {
e.preventDefault();
jump();
}
});

cvs.addEventListener("pointerdown", jump);

// ---------- UPDATE ----------
function update() {
prevBY = bY;

birdFrameTick++;
if (birdFrameTick >= BIRD_ANIM_INTERVAL) {
birdFrameTick = 0;
birdFrameIndex = (birdFrameIndex + 1) % birdFrames.length;
}

velocity += GRAVITY;
velocity = Math.max(Math.min(velocity, MAX_FALL), MAX_RISE);
bY += velocity;

if (bY + BIRD_HEIGHT >= cvs.height - GROUND_HEIGHT) {
gameOver = true;
gameState = "gameover";
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
}
}

// ---------- RENDER ----------
function render(alpha) {
ctx.clearRect(0, 0, cvs.width, cvs.height);

if (bg.complete) {
ctx.drawImage(bg, 0, 0, cvs.width, cvs.height);
} else {
ctx.fillStyle = "#70c5ce";
ctx.fillRect(0, 0, cvs.width, cvs.height);
}

ctx.fillStyle = "#228B22";

for (let p of pipes) {
const bottom = p.topHeight + GAP;
ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
ctx.fillRect(p.x, bottom, PIPE_WIDTH, cvs.height - bottom);
}

const interpolatedY = prevBY + (bY - prevBY) * alpha;

const frame = getFrame();
if (frame) {
ctx.drawImage(frame, bX, interpolatedY, BIRD_WIDTH, BIRD_HEIGHT);
}

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
ctx.fillText("LOADING...", cvs.width / 2, cvs.height / 2);
}

if (gameState === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    ctx.fillStyle = "#fff";
    ctx.font = "30px Arial"; // Рекомендуется явно задать шрифт
    ctx.textAlign = "center";  // Выравнивание по горизонтали — центр
    ctx.textBaseline = "middle"; // Выравнивание по вертикали — середина

    ctx.fillText("GAME OVER", cvs.width / 2, cvs.height / 2);
}

if (gameState === "win") {
ctx.fillStyle = "rgba(0,0,0,0.8)";
ctx.fillRect(0, 0, cvs.width, cvs.height);
ctx.fillStyle = "#fff";
ctx.fillText("ПОЧЕМУ ИЛЬЯ SHOWS 67", cvs.width / 2, cvs.height / 2);
}
}

// ---------- LOOP ----------
function draw(t = 0) {
if (!lastTime) lastTime = t;

let dt = t - lastTime;
lastTime = t;

if (dt > 100) dt = 100;

accumulator += dt;

while (accumulator >= FIXED_DT) {
update();
accumulator -= FIXED_DT;
}

const alpha = accumulator / FIXED_DT;

render(alpha);

requestAnimationFrame(draw);
}

bg.onload = () => {
assetsLoaded = true;
};

requestAnimationFrame(draw);