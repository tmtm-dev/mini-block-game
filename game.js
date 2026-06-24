const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const livesValue = document.getElementById("livesValue");
const stageValue = document.getElementById("stageValue");
const pauseButton = document.getElementById("pauseButton");
const startOverlay = document.getElementById("startOverlay");
const messageOverlay = document.getElementById("messageOverlay");
const messageEyebrow = document.getElementById("messageEyebrow");
const messageTitle = document.getElementById("messageTitle");
const messageCopy = document.getElementById("messageCopy");
const startButton = document.getElementById("startButton");
const resumeButton = document.getElementById("resumeButton");

const BEST_SCORE_KEY = "glow-breaker-best";
const pointer = { active: false, x: 0 };

const paletteSets = [
  ["#ff8b72", "#ffd166", "#40d8c2", "#70a7ff"],
  ["#ff6b57", "#ffc85c", "#64e3b7", "#5fd2ff"],
  ["#ff7a8a", "#ffc857", "#4adea6", "#7b8cff"],
];

const state = {
  running: false,
  paused: false,
  gameOver: false,
  won: false,
  score: 0,
  best: Number(localStorage.getItem(BEST_SCORE_KEY) || 0),
  lives: 3,
  stage: 1,
  combo: 0,
  comboTimer: 0,
  lastTime: 0,
  paddle: {
    width: 150,
    height: 18,
    x: 0,
    y: 0,
    targetX: 0,
  },
  ball: {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 12,
    speed: 560,
    stuck: true,
  },
  bricks: [],
  particles: [],
};

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resetPositions(false);
}

function resetPositions(resetBall = true) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  state.paddle.width = Math.max(110, width * 0.22);
  state.paddle.x = width / 2 - state.paddle.width / 2;
  state.paddle.targetX = state.paddle.x;
  state.paddle.y = height - 48;

  if (resetBall) {
    state.ball.radius = Math.max(8, width * 0.016);
    state.ball.speed = 500 + state.stage * 50;
    state.ball.x = width / 2;
    state.ball.y = state.paddle.y - 28;
    state.ball.vx = state.ball.speed * 0.75;
    state.ball.vy = -state.ball.speed;
    state.ball.stuck = true;
  }

  layoutBricks();
}

function layoutBricks() {
  if (!state.bricks.length) {
    return;
  }

  const width = canvas.clientWidth;
  const cols = 7;
  const gap = 10;
  const marginX = 18;
  const top = 92;
  const brickWidth = (width - marginX * 2 - gap * (cols - 1)) / cols;
  const brickHeight = Math.max(20, canvas.clientHeight * 0.026);

  state.bricks.forEach((brick) => {
    brick.x = marginX + brick.col * (brickWidth + gap);
    brick.y = top + brick.row * (brickHeight + gap);
    brick.width = brickWidth;
    brick.height = brickHeight;
  });
}

function buildStage(stage) {
  const rows = Math.min(4 + stage, 7);
  const cols = 7;
  const palette = paletteSets[(stage - 1) % paletteSets.length];
  const bricks = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const strength = 1 + Number((row + col + stage) % 3 === 0 && row > 1);
      bricks.push({
        row,
        col,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        strength,
        color: palette[(row + col) % palette.length],
        alive: true,
      });
    }
  }

  state.bricks = bricks;
  layoutBricks();
}

function updateHud() {
  scoreValue.textContent = String(state.score);
  bestValue.textContent = String(state.best);
  livesValue.textContent = String(state.lives);
  stageValue.textContent = String(state.stage);
}

function showMessage({ eyebrow, title, copy, button }) {
  messageEyebrow.textContent = eyebrow;
  messageTitle.innerHTML = title;
  messageCopy.textContent = copy;
  resumeButton.textContent = button;
  messageOverlay.classList.remove("hidden");
}

function hideMessage() {
  messageOverlay.classList.add("hidden");
}

function beginGame() {
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.won = false;
  state.score = 0;
  state.lives = 3;
  state.stage = 1;
  state.combo = 0;
  state.comboTimer = 0;
  state.particles = [];
  buildStage(state.stage);
  resetPositions(true);
  updateHud();
  startOverlay.classList.add("hidden");
  hideMessage();
}

function launchBall() {
  if (!state.ball.stuck) {
    return;
  }

  state.ball.stuck = false;
  const direction = pointer.x > canvas.clientWidth / 2 ? 1 : -1;
  state.ball.vx = direction * state.ball.speed * 0.72;
  state.ball.vy = -state.ball.speed;
}

function setPointerFromEvent(clientX) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = clientX - rect.left;
  pointer.active = true;
  state.paddle.targetX = clamp(pointer.x - state.paddle.width / 2, 12, canvas.clientWidth - state.paddle.width - 12);

  if (state.ball.stuck && state.running && !state.paused && !state.gameOver) {
    state.ball.x = state.paddle.targetX + state.paddle.width / 2;
  }
}

function attachControls() {
  const activate = (event) => {
    setPointerFromEvent(event.clientX ?? 0);
    if (!state.running && !state.gameOver) {
      return;
    }
    if (state.ball.stuck && !state.paused) {
      launchBall();
    }
  };

  canvas.addEventListener("pointerdown", (event) => {
    activate(event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointer.active && event.pointerType === "mouse") {
      setPointerFromEvent(event.clientX);
      return;
    }
    setPointerFromEvent(event.clientX);
  });

  canvas.addEventListener("pointerup", () => {
    pointer.active = false;
  });

  canvas.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      if (state.gameOver || state.won) {
        beginGame();
        return;
      }
      if (!state.running) {
        beginGame();
        return;
      }
      if (state.paused) {
        resumeGame();
        return;
      }
      launchBall();
    }
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function spawnBurst(x, y, color) {
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
    const speed = 70 + Math.random() * 120;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 5,
      alpha: 1,
      color,
    });
  }
}

function loseLife() {
  state.lives -= 1;
  state.combo = 0;
  state.comboTimer = 0;
  updateHud();

  if (state.lives <= 0) {
    finishGame(false);
    return;
  }

  resetPositions(true);
  showMessage({
    eyebrow: "Keep Going",
    title: "One More Shot",
    copy: "Tap to launch the ball again and jump right back in.",
    button: "Continue",
  });
  state.paused = true;
}

function finishGame(didWin) {
  state.running = false;
  state.paused = true;
  state.gameOver = !didWin;
  state.won = didWin;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(state.best));
  }
  updateHud();

  showMessage({
    eyebrow: didWin ? "All Clear" : "Game Over",
    title: didWin ? "All Stages Clear!" : "Try Again",
    copy: didWin
      ? "Chase a higher best score with one more run."
      : "Link a longer combo to boost your score fast.",
    button: "Retry",
  });
}

function advanceStage() {
  state.stage += 1;

  if (state.stage > 3) {
    finishGame(true);
    return;
  }

  state.combo = 0;
  state.comboTimer = 0;
  buildStage(state.stage);
  resetPositions(true);
  updateHud();
  showMessage({
    eyebrow: `Stage ${state.stage}`,
    title: `Stage ${state.stage}<br>Start`,
    copy: "The ball gets faster on every stage. Stay sharp.",
    button: "Next Stage",
  });
  state.paused = true;
}

function hitBrick(brick) {
  brick.strength -= 1;
  state.combo += 1;
  state.comboTimer = 1.5;

  if (brick.strength <= 0) {
    brick.alive = false;
    spawnBurst(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color);
    const points = 100 + Math.min(state.combo, 8) * 10;
    state.score += points;
  } else {
    state.score += 40;
  }

  if (state.score > state.best) {
    state.best = state.score;
  }

  if (state.bricks.every((item) => !item.alive)) {
    advanceStage();
  }

  updateHud();
}

function updateBall(delta) {
  if (state.ball.stuck) {
    state.ball.x = state.paddle.x + state.paddle.width / 2;
    state.ball.y = state.paddle.y - state.ball.radius - 10;
    return;
  }

  state.ball.x += state.ball.vx * delta;
  state.ball.y += state.ball.vy * delta;

  if (state.ball.x < state.ball.radius || state.ball.x > canvas.clientWidth - state.ball.radius) {
    state.ball.vx *= -1;
    state.ball.x = clamp(state.ball.x, state.ball.radius, canvas.clientWidth - state.ball.radius);
  }

  if (state.ball.y < state.ball.radius + 8) {
    state.ball.vy *= -1;
    state.ball.y = state.ball.radius + 8;
  }

  if (state.ball.y > canvas.clientHeight + state.ball.radius) {
    loseLife();
    return;
  }

  const paddleTop = state.paddle.y;
  const paddleBottom = state.paddle.y + state.paddle.height;
  const paddleLeft = state.paddle.x;
  const paddleRight = state.paddle.x + state.paddle.width;

  if (
    state.ball.y + state.ball.radius >= paddleTop &&
    state.ball.y - state.ball.radius <= paddleBottom &&
    state.ball.x >= paddleLeft &&
    state.ball.x <= paddleRight &&
    state.ball.vy > 0
  ) {
    const offset = (state.ball.x - (state.paddle.x + state.paddle.width / 2)) / (state.paddle.width / 2);
    state.ball.vx = offset * state.ball.speed * 0.92;
    state.ball.vy = -Math.abs(state.ball.vy);
    state.ball.y = paddleTop - state.ball.radius - 1;
  }

  for (const brick of state.bricks) {
    if (!brick.alive) {
      continue;
    }

    const overlaps =
      state.ball.x + state.ball.radius > brick.x &&
      state.ball.x - state.ball.radius < brick.x + brick.width &&
      state.ball.y + state.ball.radius > brick.y &&
      state.ball.y - state.ball.radius < brick.y + brick.height;

    if (!overlaps) {
      continue;
    }

    const ballCenterX = state.ball.x;
    const ballCenterY = state.ball.y;
    const brickCenterX = brick.x + brick.width / 2;
    const brickCenterY = brick.y + brick.height / 2;
    const dx = (ballCenterX - brickCenterX) / (brick.width / 2);
    const dy = (ballCenterY - brickCenterY) / (brick.height / 2);

    if (Math.abs(dx) > Math.abs(dy)) {
      state.ball.vx *= -1;
    } else {
      state.ball.vy *= -1;
    }

    hitBrick(brick);
    break;
  }
}

function updateParticles(delta) {
  state.particles = state.particles.filter((particle) => particle.alpha > 0.02);
  state.particles.forEach((particle) => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 120 * delta;
    particle.alpha -= delta * 1.8;
  });
}

function update(delta) {
  if (!state.running || state.paused) {
    return;
  }

  state.paddle.x += (state.paddle.targetX - state.paddle.x) * Math.min(1, delta * 16);

  if (state.comboTimer > 0) {
    state.comboTimer -= delta;
  } else {
    state.combo = 0;
  }

  updateBall(delta);
  updateParticles(delta);
}

function drawBackground() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#0f2345");
  gradient.addColorStop(1, "#150f2c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    const x = (i * 57) % width;
    const y = (i * 91) % height;
    ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBricks() {
  state.bricks.forEach((brick) => {
    if (!brick.alive) {
      return;
    }

    const alpha = brick.strength === 2 ? 0.95 : 0.82;
    const glow = brick.strength === 2 ? 22 : 12;

    ctx.save();
    ctx.shadowBlur = glow;
    ctx.shadowColor = brick.color;
    ctx.fillStyle = `${brick.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
    roundRect(ctx, brick.x, brick.y, brick.width, brick.height, 10);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    roundRect(ctx, brick.x + 3, brick.y + 3, brick.width - 6, brick.height * 0.38, 8);
    ctx.fill();
    ctx.restore();
  });
}

function drawPaddle() {
  const { x, y, width, height } = state.paddle;
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#b4fff3");

  ctx.save();
  ctx.shadowBlur = 24;
  ctx.shadowColor = "rgba(84, 255, 225, 0.34)";
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.restore();
}

function drawBall() {
  const gradient = ctx.createRadialGradient(
    state.ball.x - 4,
    state.ball.y - 4,
    2,
    state.ball.x,
    state.ball.y,
    state.ball.radius
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#ffcf5c");

  ctx.save();
  ctx.shadowBlur = 26;
  ctx.shadowColor = "rgba(255, 207, 92, 0.52)";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawCombo() {
  if (state.combo < 2 || state.comboTimer <= 0) {
    return;
  }

  ctx.save();
  ctx.font = '700 20px "Aptos", "Yu Gothic UI", sans-serif';
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.textAlign = "left";
  ctx.fillText(`COMBO x${state.combo}`, 22, canvas.clientHeight - 22);
  ctx.restore();
}

function drawStageLabel() {
  ctx.save();
  ctx.font = '700 16px "Aptos", "Yu Gothic UI", sans-serif';
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.textAlign = "right";
  ctx.fillText(`STAGE ${state.stage}`, canvas.clientWidth - 18, 28);
  ctx.restore();
}

function draw() {
  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();
  drawParticles();
  drawCombo();
  drawStageLabel();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function resumeGame() {
  if (state.gameOver || state.won) {
    beginGame();
    return;
  }

  state.paused = false;
  hideMessage();
}

function togglePause() {
  if (!state.running || state.gameOver || state.won) {
    return;
  }

  state.paused = !state.paused;
  if (state.paused) {
    showMessage({
      eyebrow: "Paused",
      title: "Break Time",
      copy: "Resume whenever you are ready.",
      button: "Resume",
    });
  } else {
    hideMessage();
  }
}

function frame(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const delta = Math.min((timestamp - state.lastTime) / 1000, 0.018);
  state.lastTime = timestamp;

  update(delta);
  draw();
  window.requestAnimationFrame(frame);
}

pauseButton.addEventListener("click", togglePause);
startButton.addEventListener("click", beginGame);
resumeButton.addEventListener("click", resumeGame);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("blur", () => {
  if (state.running && !state.paused && !state.gameOver && !state.won) {
    togglePause();
  }
});

attachControls();
buildStage(1);
resizeCanvas();
updateHud();
window.requestAnimationFrame(frame);
