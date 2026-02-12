const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const keys = {
  left: false,
  right: false,
  jump: false,
  down: false,
};

const GRAVITY = 0.78;
const MOVE_SPEED = 4.2;
const JUMP_FORCE = -14.2;
const FLOOR_Y = 440;

const LEVELS = [
  {
    id: 1,
    name: "Level 1",
    baseSpeed: 3.1,
    gapChance: 0.16,
    platformChance: 0.34,
    levelLength: 2700,
    pipeX: 2300,
    pipeWidth: 64,
    pipeHeight: 86,
    objective: "Get to the green pipe and press ↓",
  },
  {
    id: 2,
    name: "Level 2",
    baseSpeed: 3.9,
    gapChance: 0.26,
    platformChance: 0.45,
    levelLength: 3200,
    pipeX: null,
    pipeWidth: 0,
    pipeHeight: 0,
    objective: "Reach the flag to win",
  },
];

const player = {
  x: 180,
  y: FLOOR_Y - 56,
  w: 38,
  h: 56,
  vx: 0,
  vy: 0,
  onGround: false,
};

const world = {
  offsetX: 0,
  score: 0,
  best: 0,
  gameOver: false,
  won: false,
  transitioning: false,
  transitionTimer: 0,
  currentLevelIndex: 0,
  chunks: [],
};

function currentLevel() {
  return LEVELS[world.currentLevelIndex];
}

function createChunk(startX, width, kind = "ground", heightOffset = 0) {
  return {
    x: startX,
    y: FLOOR_Y - heightOffset,
    width,
    height: kind === "ground" ? canvas.height - FLOOR_Y : 20,
    kind,
  };
}

function buildLevel(level) {
  world.chunks = [];
  world.offsetX = 0;

  let x = -100;
  while (x < level.levelLength + 300) {
    if (Math.random() < level.gapChance && x > 260 && x < level.levelLength - 180) {
      x += 90 + Math.random() * 120;
      continue;
    }

    const width = 170 + Math.random() * 210;
    world.chunks.push(createChunk(x, width));

    if (Math.random() < level.platformChance) {
      const platformWidth = 85 + Math.random() * 120;
      const platformX = x + 25 + Math.random() * Math.max(20, width - 120);
      const height = 95 + Math.random() * 120;
      world.chunks.push(createChunk(platformX, platformWidth, "platform", height));
    }

    x += width;
  }

  player.x = 180;
  player.y = FLOOR_Y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
}

function restartGame() {
  world.score = 0;
  world.gameOver = false;
  world.won = false;
  world.transitioning = false;
  world.transitionTimer = 0;
  world.currentLevelIndex = 0;
  buildLevel(currentLevel());
}

function getVisibleChunks() {
  const left = world.offsetX - 80;
  const right = world.offsetX + canvas.width + 80;
  return world.chunks.filter((chunk) => chunk.x + chunk.width >= left && chunk.x <= right);
}

function overlapsHorizontally(rect, chunk) {
  const worldPlayerLeft = rect.x + world.offsetX;
  const worldPlayerRight = worldPlayerLeft + rect.w;
  return worldPlayerRight > chunk.x && worldPlayerLeft < chunk.x + chunk.width;
}

function resolveCollisions(previousY) {
  player.onGround = false;

  for (const chunk of getVisibleChunks()) {
    if (!overlapsHorizontally(player, chunk)) continue;

    const top = chunk.y;
    const prevBottom = previousY + player.h;
    const currentBottom = player.y + player.h;

    if (prevBottom <= top && currentBottom >= top && player.vy >= 0) {
      player.y = top - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }
}

function isAtPipe() {
  const level = currentLevel();
  if (!level.pipeX) return false;

  const worldPlayerCenter = world.offsetX + player.x + player.w / 2;
  const pipeLeft = level.pipeX;
  const pipeRight = pipeLeft + level.pipeWidth;
  return player.onGround && worldPlayerCenter > pipeLeft - 20 && worldPlayerCenter < pipeRight + 20;
}

function update() {
  if (world.gameOver || world.won) return;

  if (world.transitioning) {
    world.transitionTimer -= 1;
    if (world.transitionTimer <= 0) {
      world.transitioning = false;
      world.currentLevelIndex = 1;
      buildLevel(currentLevel());
    }
    return;
  }

  const level = currentLevel();
  const previousY = player.y;

  player.vx = 0;
  if (keys.left) player.vx -= MOVE_SPEED;
  if (keys.right) player.vx += MOVE_SPEED;

  player.x += player.vx;
  player.x = Math.max(80, Math.min(canvas.width - player.w - 90, player.x));

  world.offsetX += level.baseSpeed + Math.max(0, player.vx * 0.55);
  world.score += level.baseSpeed * 0.13 + Math.max(0, player.vx * 0.05);

  if (keys.jump && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  player.vy += GRAVITY;
  player.y += player.vy;

  resolveCollisions(previousY);

  if (player.y > canvas.height + 120) {
    world.gameOver = true;
    world.best = Math.max(world.best, Math.floor(world.score));
    return;
  }

  if (level.id === 1 && isAtPipe() && keys.down) {
    world.transitioning = true;
    world.transitionTimer = 75;
    return;
  }

  if (level.id === 2 && world.offsetX >= level.levelLength) {
    world.won = true;
    world.best = Math.max(world.best, Math.floor(world.score));
  }
}

function drawChunk(chunk) {
  const x = chunk.x - world.offsetX;

  if (chunk.kind === "ground") {
    ctx.fillStyle = "#6c4f31";
    ctx.fillRect(x, chunk.y, chunk.width, chunk.height);
    ctx.fillStyle = "#3f9d4f";
    ctx.fillRect(x, chunk.y - 10, chunk.width, 10);
    return;
  }

  ctx.fillStyle = "#8f5938";
  ctx.fillRect(x, chunk.y, chunk.width, chunk.height);
  ctx.fillStyle = "#d6b077";
  ctx.fillRect(x + 4, chunk.y + 4, chunk.width - 8, chunk.height - 8);
}

function drawPipe() {
  const level = currentLevel();
  if (!level.pipeX) return;

  const x = level.pipeX - world.offsetX;
  const y = FLOOR_Y - level.pipeHeight;

  ctx.fillStyle = "#1f9a38";
  ctx.fillRect(x, y + 10, level.pipeWidth, level.pipeHeight - 10);
  ctx.fillStyle = "#35c04f";
  ctx.fillRect(x - 8, y, level.pipeWidth + 16, 16);
}

function drawFlag() {
  const level = currentLevel();
  if (level.id !== 2) return;

  const x = level.levelLength - world.offsetX;
  const poleY = FLOOR_Y - 150;
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(x, poleY, 6, 150);
  ctx.fillStyle = "#f5d742";
  ctx.fillRect(x + 6, poleY + 8, 42, 24);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = "#d8342a";
  ctx.fillRect(8, 0, 22, 14);

  ctx.fillStyle = "#f4be97";
  ctx.fillRect(9, 14, 20, 16);

  ctx.fillStyle = "#223f9e";
  ctx.fillRect(6, 30, 26, 26);

  ctx.fillStyle = "#73301f";
  ctx.fillRect(5, 50, 10, 6);
  ctx.fillRect(23, 50, 10, 6);

  ctx.restore();
}

function drawHUD() {
  const level = currentLevel();

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(14, 14, 345, 94);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Segoe UI";
  ctx.fillText(`Score: ${Math.floor(world.score)}`, 24, 42);
  ctx.font = "18px Segoe UI";
  ctx.fillText(`Best: ${world.best}`, 24, 66);
  ctx.fillText(`${level.name}: ${level.objective}`, 24, 91);

  if (level.id === 1 && isAtPipe() && !world.transitioning) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(canvas.width / 2 - 170, 122, 340, 40);
    ctx.fillStyle = "#e3ffe3";
    ctx.font = "bold 20px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("Press ↓ to go down the pipe", canvas.width / 2, 150);
    ctx.textAlign = "start";
  }

  if (world.transitioning) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0fff0";
    ctx.textAlign = "center";
    ctx.font = "bold 42px Segoe UI";
    ctx.fillText("Entering Pipe...", canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = "24px Segoe UI";
    ctx.fillText("Level 2 incoming", canvas.width / 2, canvas.height / 2 + 30);
    ctx.textAlign = "start";
  }

  if (world.gameOver || world.won) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffefef";
    ctx.textAlign = "center";
    ctx.font = "bold 48px Segoe UI";
    ctx.fillText(world.won ? "You Beat Both Levels!" : "You Fell!", canvas.width / 2, canvas.height / 2 - 18);
    ctx.font = "24px Segoe UI";
    ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 28);
    ctx.textAlign = "start";
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const chunk of getVisibleChunks()) {
    drawChunk(chunk);
  }

  drawPipe();
  drawFlag();
  drawPlayer();
  drawHUD();
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft") keys.left = true;
  if (event.code === "ArrowRight") keys.right = true;
  if (event.code === "ArrowUp" || event.code === "Space") keys.jump = true;
  if (event.code === "ArrowDown") keys.down = true;

  if (event.code === "KeyR" && (world.gameOver || world.won)) {
    restartGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft") keys.left = false;
  if (event.code === "ArrowRight") keys.right = false;
  if (event.code === "ArrowUp" || event.code === "Space") keys.jump = false;
  if (event.code === "ArrowDown") keys.down = false;
});

restartGame();
loop();
