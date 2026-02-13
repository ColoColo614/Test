const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const keys = {
  left: false,
  right: false,
  jump: false,
  down: false,
};

const GRAVITY = 0.78;
const MOVE_SPEED = 3.57; // 15% slower than the original baseline
const BACKWARD_SPEED_MULTIPLIER = 1.5;
const SCROLL_SPEED_MULTIPLIER = 1.1;
const JUMP_FORCE = -17.75;
const FLOOR_Y = 440;

const SAFE_GAP_MIN = 73;
const SAFE_GAP_MAX = 275;
const SAFE_PLATFORM_HEIGHT_MAX = 180;
const SPAWN_SAFE_RUNWAY = 560;
const STOMP_SCORE = 120;
const PIPE_BONUS = 220;
const WIN_BONUS = 1500;

const LEVELS = [
  {
    id: 1,
    name: "Level 1",
    baseSpeed: 3.0,
    levelLength: 2850,
    objective: "Reach the pipe and press ↓",
    hasPipe: true,
    hasFlag: false,
    enemyCount: 3,
  },
  {
    id: 2,
    name: "Level 2",
    baseSpeed: 3.45,
    levelLength: 3250,
    objective: "Use the second pipe to descend",
    hasPipe: true,
    hasFlag: false,
    enemyCount: 5,
  },
  {
    id: 3,
    name: "Level 3",
    baseSpeed: 3.85,
    levelLength: 3725,
    objective: "Reach the flag on land to win",
    hasPipe: false,
    hasFlag: true,
    enemyCount: 7,
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
  nextLevelIndex: 0,
  currentLevelIndex: 0,
  chunks: [],
  enemies: [],
  pipe: null,
  flagX: null,
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

function generateSafeTerrain(level) {
  const chunks = [];
  chunks.push(createChunk(-160, SPAWN_SAFE_RUNWAY));
  let x = -160 + SPAWN_SAFE_RUNWAY;

  while (x < level.levelLength + 440) {
    const width = 190 + Math.random() * 190;
    chunks.push(createChunk(x, width));

    if (Math.random() < 0.45) {
      const platformWidth = 90 + Math.random() * 110;
      const platformX = x + 20 + Math.random() * Math.max(25, width - platformWidth - 20);
      const platformHeight = 70 + Math.random() * (SAFE_PLATFORM_HEIGHT_MAX - 70);
      const primary = createChunk(platformX, platformWidth, "platform", platformHeight);
      chunks.push(primary);

      if (Math.random() < 0.58) {
        const secondaryWidth = Math.max(72, platformWidth * (0.55 + Math.random() * 0.22));
        const maxShift = Math.max(8, platformWidth - secondaryWidth - 8);
        const secondaryX = primary.x + 4 + Math.random() * maxShift;
        const extraHeight = 46 + Math.random() * 52;
        const secondaryHeight = Math.min(SAFE_PLATFORM_HEIGHT_MAX + 80, platformHeight + extraHeight);
        chunks.push(createChunk(secondaryX, secondaryWidth, "platform", secondaryHeight));
      }
    }

    x += width;
    if (x < level.levelLength + 320) {
      x += SAFE_GAP_MIN + Math.random() * (SAFE_GAP_MAX - SAFE_GAP_MIN);
    }
  }

  return chunks;
}

function findGroundChunkAt(chunks, targetX) {
  return chunks.find((chunk) => chunk.kind === "ground" && targetX >= chunk.x + 12 && targetX <= chunk.x + chunk.width - 12);
}

function placePipeOnLand(level, chunks) {
  if (!level.hasPipe) return null;

  let candidateX = level.levelLength - 340;
  let ground = findGroundChunkAt(chunks, candidateX);

  if (!ground) {
    const fallback = chunks
      .filter((chunk) => chunk.kind === "ground" && chunk.x > level.levelLength - 850)
      .sort((a, b) => b.width - a.width)[0];

    if (!fallback) return null;
    candidateX = fallback.x + fallback.width * 0.5;
    ground = fallback;
  }

  return {
    x: Math.max(ground.x + 20, Math.min(candidateX, ground.x + ground.width - 84)),
    width: 64,
    height: 86,
  };
}

function placeFlagOnLand(level, chunks) {
  if (!level.hasFlag) return null;

  let candidateX = level.levelLength - 90;
  let ground = findGroundChunkAt(chunks, candidateX);

  if (!ground) {
    const fallback = chunks
      .filter((chunk) => chunk.kind === "ground" && chunk.x > level.levelLength - 850)
      .sort((a, b) => b.width - a.width)[0];

    if (!fallback) return level.levelLength;
    ground = fallback;
    candidateX = fallback.x + fallback.width - 46;
  }

  return Math.max(ground.x + 24, Math.min(candidateX, ground.x + ground.width - 16));
}

function buildEnemies(level, chunks) {
  const enemies = [];
  const candidates = chunks
    .filter((chunk) => chunk.kind === "ground" && chunk.width > 170 && chunk.x > 260 && chunk.x < level.levelLength - 220)
    .sort((a, b) => a.x - b.x);

  const step = Math.max(1, Math.floor(candidates.length / Math.max(1, level.enemyCount)));
  const speedMultiplier = level.id >= 2 ? 1.15 : 1;

  for (let i = 0; i < candidates.length && enemies.length < level.enemyCount; i += step) {
    const chunk = candidates[i];
    const margin = 24;
    enemies.push({
      x: chunk.x + margin + Math.random() * Math.max(8, chunk.width - margin * 2 - 20),
      y: chunk.y - 30,
      w: 32,
      h: 30,
      vx: (Math.random() < 0.5 ? -1.25 : 1.25) * speedMultiplier,
      minX: chunk.x + margin,
      maxX: chunk.x + chunk.width - margin - 32,
      alive: true,
    });
  }

  return enemies;
}

function buildLevel(level) {
  world.offsetX = 0;
  world.chunks = generateSafeTerrain(level);
  world.pipe = placePipeOnLand(level, world.chunks);
  world.flagX = placeFlagOnLand(level, world.chunks);
  world.enemies = buildEnemies(level, world.chunks);

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
  world.nextLevelIndex = 0;
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

function updateEnemies() {
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;

    enemy.x += enemy.vx;
    if (enemy.x <= enemy.minX || enemy.x >= enemy.maxX) {
      enemy.vx *= -1;
      enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX, enemy.x));
    }
  }
}

function playerEnemyWorldRect() {
  return {
    left: world.offsetX + player.x,
    right: world.offsetX + player.x + player.w,
    top: player.y,
    bottom: player.y + player.h,
  };
}

function handleEnemyCollisions(previousY) {
  const playerRect = playerEnemyWorldRect();
  const previousBottom = previousY + player.h;

  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;

    const enemyLeft = enemy.x;
    const enemyRight = enemy.x + enemy.w;
    const enemyTop = enemy.y;
    const enemyBottom = enemy.y + enemy.h;

    const touching =
      playerRect.right > enemyLeft &&
      playerRect.left < enemyRight &&
      playerRect.bottom > enemyTop &&
      playerRect.top < enemyBottom;

    if (!touching) continue;

    const stomped = player.vy > 0 && previousBottom <= enemyTop + 8;
    if (stomped) {
      enemy.alive = false;
      player.vy = -9.5;
      world.score += STOMP_SCORE;
      continue;
    }

    world.gameOver = true;
    world.best = Math.max(world.best, Math.floor(world.score));
    return;
  }
}

function isAtPipe() {
  if (!world.pipe) return false;

  const worldPlayerCenter = world.offsetX + player.x + player.w / 2;
  const pipeLeft = world.pipe.x;
  const pipeRight = pipeLeft + world.pipe.width;
  return player.onGround && worldPlayerCenter > pipeLeft - 20 && worldPlayerCenter < pipeRight + 20;
}

function update() {
  if (world.gameOver || world.won) return;

  if (world.transitioning) {
    world.transitionTimer -= 1;
    if (world.transitionTimer <= 0) {
      world.transitioning = false;
      world.currentLevelIndex = world.nextLevelIndex;
      buildLevel(currentLevel());
    }
    return;
  }

  const level = currentLevel();
  const previousY = player.y;

  player.vx = 0;
  if (keys.left) player.vx -= MOVE_SPEED * BACKWARD_SPEED_MULTIPLIER;
  if (keys.right) player.vx += MOVE_SPEED;

  player.x += player.vx;
  player.x = Math.max(80, Math.min(canvas.width - player.w - 90, player.x));

  world.offsetX += (level.baseSpeed + Math.max(0, player.vx * 0.55)) * SCROLL_SPEED_MULTIPLIER;
  world.score += level.baseSpeed * 0.13 + Math.max(0, player.vx * 0.05);

  if (keys.jump && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  player.vy += GRAVITY;
  player.y += player.vy;

  resolveCollisions(previousY);
  updateEnemies();
  handleEnemyCollisions(previousY);

  if (world.gameOver) return;

  if (player.y > canvas.height + 120) {
    world.gameOver = true;
    world.best = Math.max(world.best, Math.floor(world.score));
    return;
  }

  if (level.hasPipe && isAtPipe() && keys.down) {
    world.score += PIPE_BONUS;
    world.transitioning = true;
    world.transitionTimer = 72;
    world.nextLevelIndex = Math.min(LEVELS.length - 1, world.currentLevelIndex + 1);
    return;
  }

  if (level.hasFlag && world.flagX !== null && world.offsetX >= world.flagX - 60) {
    world.score += WIN_BONUS;
    world.won = true;
    world.best = Math.max(world.best, Math.floor(world.score));
  }
}

function drawBackground() {
  ctx.fillStyle = "#ffd66b";
  ctx.beginPath();
  ctx.arc(140, 96, 44, 0, Math.PI * 2);
  ctx.fill();

  const cloudDrift = (world.offsetX * 0.18) % 1200;
  const clouds = [
    { x: 220 - cloudDrift, y: 96, s: 1.05 },
    { x: 520 - cloudDrift * 0.92, y: 72, s: 1.2 },
    { x: 860 - cloudDrift * 1.08, y: 118, s: 0.95 },
    { x: 1120 - cloudDrift, y: 84, s: 1.1 },
  ];

  for (const cloud of clouds) {
    const baseX = ((cloud.x % 1200) + 1200) % 1200 - 120;
    const y = cloud.y;
    const r = 22 * cloud.s;

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.arc(baseX, y, r, 0, Math.PI * 2);
    ctx.arc(baseX + r * 0.9, y - 10, r * 0.85, 0, Math.PI * 2);
    ctx.arc(baseX + r * 1.9, y - 2, r * 1.05, 0, Math.PI * 2);
    ctx.arc(baseX + r * 3, y, r * 0.88, 0, Math.PI * 2);
    ctx.fill();
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
  if (!world.pipe) return;

  const x = world.pipe.x - world.offsetX;
  const y = FLOOR_Y - world.pipe.height;

  ctx.fillStyle = "#1f9a38";
  ctx.fillRect(x, y + 10, world.pipe.width, world.pipe.height - 10);
  ctx.fillStyle = "#35c04f";
  ctx.fillRect(x - 8, y, world.pipe.width + 16, 16);
}

function drawFlag() {
  const level = currentLevel();
  if (!level.hasFlag || world.flagX === null) return;

  const x = world.flagX - world.offsetX;
  const poleY = FLOOR_Y - 150;
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(x, poleY, 6, 150);
  ctx.fillStyle = "#f5d742";
  ctx.fillRect(x + 6, poleY + 8, 42, 24);
}

function drawEnemies() {
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    const x = enemy.x - world.offsetX;

    ctx.fillStyle = "#6e3f1f";
    ctx.fillRect(x, enemy.y + 10, enemy.w, enemy.h - 10);

    ctx.fillStyle = "#8f552f";
    ctx.fillRect(x + 2, enemy.y, enemy.w - 4, 16);

    ctx.fillStyle = "#1d1d1d";
    ctx.fillRect(x + 8, enemy.y + 6, 4, 4);
    ctx.fillRect(x + 20, enemy.y + 6, 4, 4);
  }
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
  ctx.fillRect(14, 14, 420, 94);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Segoe UI";
  ctx.fillText(`Score: ${Math.floor(world.score)}`, 24, 42);
  ctx.font = "18px Segoe UI";
  ctx.fillText(`Best: ${world.best}`, 24, 66);
  ctx.fillText(`${level.name}: ${level.objective}`, 24, 91);

  if (level.hasPipe && isAtPipe() && !world.transitioning) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(canvas.width / 2 - 190, 122, 380, 40);
    ctx.fillStyle = "#e3ffe3";
    ctx.font = "bold 20px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(`Press ↓ to go down the pipe (+${PIPE_BONUS})`, canvas.width / 2, 150);
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
    ctx.fillText(`Level ${world.nextLevelIndex + 1} incoming`, canvas.width / 2, canvas.height / 2 + 30);
    ctx.textAlign = "start";
  }

  if (world.gameOver || world.won) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffefef";
    ctx.textAlign = "center";
    ctx.font = "bold 46px Segoe UI";
    ctx.fillText(world.won ? "You Beat Mini Plumber Run 1.4!" : "You Lost!", canvas.width / 2, canvas.height / 2 - 18);
    ctx.font = "24px Segoe UI";
    ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 28);
    ctx.textAlign = "start";
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  for (const chunk of getVisibleChunks()) {
    drawChunk(chunk);
  }

  drawPipe();
  drawFlag();
  drawEnemies();
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
