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
const BACKWARD_SPEED_MULTIPLIER = 2.6;
const BASE_SCROLL_SPEED_MULTIPLIER = 1.2;
const SPEED_RUN_SCROLL_MULTIPLIER = 1.2;
const SPEED_RUN_ENEMY_MULTIPLIER = 1.1;
const JUMP_FORCE = -17.75;
const FLOOR_Y = 440;

const SAFE_GAP_MIN = 88;
const SAFE_GAP_MAX = 330;
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
    objective: "Reach the third pipe",
    hasPipe: true,
    hasFlag: false,
    enemyCount: 7,
  },
  {
    id: 4,
    name: "Level 4",
    baseSpeed: 4.15,
    levelLength: 4200,
    objective: "Reach the fourth pipe",
    hasPipe: true,
    hasFlag: false,
    enemyCount: 8,
    enemySpeedMultiplier: 1.32,
  },
  {
    id: 5,
    name: "Level 5",
    baseSpeed: 4.35,
    levelLength: 4480,
    objective: "Reach the final flag on land",
    hasPipe: false,
    hasFlag: true,
    enemyCount: 10,
    enemySpeedMultiplier: 1.452,
  },
];

const CHARACTER_PALETTES = {
  classic: {
    name: "Classic",
    hat: "#d8342a",
    skin: "#f4be97",
    suit: "#223f9e",
    shoes: "#73301f",
  },
  green: {
    name: "Green Suit",
    hat: "#1f8f3a",
    skin: "#f4be97",
    suit: "#2fbe57",
    shoes: "#5b3a1f",
  },
};

const RUN_MODES = {
  normal: {
    name: "Normal Run",
    scrollMultiplier: 1,
  },
  speed: {
    name: "Speed Run",
    scrollMultiplier: SPEED_RUN_SCROLL_MULTIPLIER,
  },
};

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
  flag: null,
  paused: false,
  dropThroughTimer: 0,
  standingOnPlatform: false,
  star: null,
  collectedStars: 0,
  awaitingModeSelect: true,
  awaitingCharacterSelect: false,
  selectedMode: null,
  selectedCharacter: null,
  isNewHighScore: false,
  deaths: 0,
  menuUnlocked: false,
};

function currentLevel() {
  return LEVELS[world.currentLevelIndex];
}

function finalizeRun(gameWon) {
  const finalScore = Math.floor(world.score);
  world.isNewHighScore = finalScore > world.best;
  world.best = Math.max(world.best, finalScore);
  world.won = gameWon;
  world.gameOver = !gameWon;

  if (!gameWon) {
    world.deaths += 1;
    if (world.deaths >= 10) {
      world.menuUnlocked = true;
    }
  }
}

function createChunk(startX, width, kind = "ground", heightOffset = 0) {
  const y = FLOOR_Y - heightOffset;
  return {
    x: startX,
    y,
    width,
    height: kind === "ground" ? canvas.height - y : 20,
    kind,
  };
}

function generateSafeTerrain(level) {
  const chunks = [];
  let currentGroundHeight = 0;
  chunks.push(createChunk(-160, SPAWN_SAFE_RUNWAY, "ground", currentGroundHeight));
  let x = -160 + SPAWN_SAFE_RUNWAY;

  while (x < level.levelLength + 440) {
    const width = 250 + Math.random() * 250;

    const heightShift = (Math.random() - 0.5) * 46;
    currentGroundHeight = Math.max(0, Math.min(120, currentGroundHeight + heightShift));

    const ground = createChunk(x, width, "ground", currentGroundHeight);
    chunks.push(ground);

    if (Math.random() < 0.5625) {
      const platformWidth = 90 + Math.random() * 110;
      const platformX = x + 20 + Math.random() * Math.max(25, width - platformWidth - 20);
      const platformHeight = 70 + Math.random() * (SAFE_PLATFORM_HEIGHT_MAX - 70);
      const primary = createChunk(platformX, platformWidth, "platform", currentGroundHeight + platformHeight);
      chunks.push(primary);

      if (Math.random() < 0.58) {
        const secondaryWidth = Math.max(72, platformWidth * (0.55 + Math.random() * 0.22));
        const secondaryX = primary.x + primary.width + 12 + Math.random() * 52;
        const primaryRelativeHeight = platformHeight;
        const fromPrimaryLift = 42 + Math.random() * 36;
        const minFromGround = 215;
        const secondaryRelativeHeight = Math.max(minFromGround, primaryRelativeHeight + fromPrimaryLift);
        const secondaryHeight = Math.min(300, currentGroundHeight + secondaryRelativeHeight);
        chunks.push(createChunk(secondaryX, secondaryWidth, "platform", secondaryHeight));
      }
    }

    x += width;
    if (x < level.levelLength + 320 && Math.random() < 0.8) {
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
    groundY: ground.y,
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

    if (!fallback) return { x: level.levelLength, groundY: FLOOR_Y };
    ground = fallback;
    candidateX = fallback.x + fallback.width - 46;
  }

  return {
    x: Math.max(ground.x + 24, Math.min(candidateX, ground.x + ground.width - 16)),
    groundY: ground.y,
  };
}

function placeStar(level, chunks) {
  const platforms = chunks.filter((chunk) => chunk.kind === "platform" && chunk.y < FLOOR_Y - 120);
  const pool = platforms.length ? platforms : chunks.filter((chunk) => chunk.kind === "ground" && chunk.x > level.levelLength * 0.65);
  if (!pool.length) return null;

  const hardest = pool.sort((a, b) => a.y - b.y)[0];
  return {
    x: hardest.x + hardest.width * 0.5,
    y: hardest.y - 26,
    collected: false,
    value: STOMP_SCORE + 20,
  };
}

function buildEnemies(level, chunks) {
  const enemies = [];
  const candidates = chunks
    .filter((chunk) => chunk.kind === "ground" && chunk.width > 170 && chunk.x > 260 && chunk.x < level.levelLength - 220)
    .sort((a, b) => a.x - b.x);

  const step = Math.max(1, Math.floor(candidates.length / Math.max(1, level.enemyCount)));
  const speedModeEnemyBoost = world.selectedMode === "speed" && level.id <= 4 ? SPEED_RUN_ENEMY_MULTIPLIER : 1;
  const speedMultiplier = (level.enemySpeedMultiplier || 1) * speedModeEnemyBoost;

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

function startModeSelect() {
  world.awaitingModeSelect = true;
  world.awaitingCharacterSelect = false;
  world.selectedMode = null;
  world.selectedCharacter = null;
  world.paused = false;
}

function chooseMode(modeKey) {
  if (!RUN_MODES[modeKey]) return;
  world.selectedMode = modeKey;
  world.awaitingModeSelect = false;
  world.awaitingCharacterSelect = true;
}

function chooseCharacter(characterKey) {
  if (!CHARACTER_PALETTES[characterKey] || !world.selectedMode) return;
  world.selectedCharacter = characterKey;
  world.awaitingCharacterSelect = false;
  restartGame();
}

function buildLevel(level) {
  world.offsetX = 0;
  world.chunks = generateSafeTerrain(level);
  world.pipe = placePipeOnLand(level, world.chunks);
  world.flag = placeFlagOnLand(level, world.chunks);
  world.enemies = buildEnemies(level, world.chunks);
  world.star = placeStar(level, world.chunks);

  player.x = 180;
  player.y = world.chunks[0].y - player.h;
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
  world.paused = false;
  world.isNewHighScore = false;
  world.dropThroughTimer = 0;
  world.standingOnPlatform = false;
  world.collectedStars = 0;
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

function resolveCollisions(previousX, previousY) {
  player.onGround = false;
  world.standingOnPlatform = false;

  const previousWorldLeft = previousX + world.offsetX;
  const previousWorldTop = previousY;

  for (const chunk of getVisibleChunks()) {
    const currentWorldLeft = player.x + world.offsetX;
    const currentWorldTop = player.y;
    const currentWorldRight = currentWorldLeft + player.w;
    const currentWorldBottom = currentWorldTop + player.h;

    const chunkLeft = chunk.x;
    const chunkRight = chunk.x + chunk.width;
    const chunkTop = chunk.y;
    const chunkBottom = chunk.y + chunk.height;

    const overlaps =
      currentWorldRight > chunkLeft &&
      currentWorldLeft < chunkRight &&
      currentWorldBottom > chunkTop &&
      currentWorldTop < chunkBottom;

    if (!overlaps) continue;

    const previousWorldRight = previousWorldLeft + player.w;
    const previousWorldBottom = previousWorldTop + player.h;

    const droppingThroughPlatform = chunk.kind === "platform" && world.dropThroughTimer > 0;

    if (!droppingThroughPlatform && previousWorldBottom <= chunkTop && currentWorldBottom >= chunkTop && player.vy >= 0) {
      player.y = chunkTop - player.h;
      player.vy = 0;
      player.onGround = true;
      if (chunk.kind === "platform") {
        world.standingOnPlatform = true;
      }
      continue;
    }

    if (chunk.kind === "platform") {
      continue;
    }

    if (previousWorldTop >= chunkBottom && currentWorldTop < chunkBottom && player.vy < 0) {
      player.y = chunkBottom;
      player.vy = 0;
      continue;
    }

    if (previousWorldRight <= chunkLeft && currentWorldRight > chunkLeft) {
      const worldX = chunkLeft - player.w;
      player.x = worldX - world.offsetX;
      player.vx = Math.min(0, player.vx);
      continue;
    }

    if (previousWorldLeft >= chunkRight && currentWorldLeft < chunkRight) {
      const worldX = chunkRight;
      player.x = worldX - world.offsetX;
      player.vx = Math.max(0, player.vx);
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

    finalizeRun(false);
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
function handleStarCollection() {
  if (!world.star || world.star.collected) return;

  const px = world.offsetX + player.x + player.w / 2;
  const py = player.y + player.h / 2;
  if (Math.abs(px - world.star.x) < 26 && Math.abs(py - world.star.y) < 30) {
    world.star.collected = true;
    world.collectedStars += 1;
    world.score += world.star.value;
  }
}


function update() {
  if (world.awaitingModeSelect || world.awaitingCharacterSelect || world.gameOver || world.won || world.paused) return;

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
  const previousX = player.x;
  const previousY = player.y;

  player.vx = 0;
  if (keys.left) player.vx -= MOVE_SPEED * BACKWARD_SPEED_MULTIPLIER;
  if (keys.right) player.vx += MOVE_SPEED;

  player.x += player.vx;
  player.x = Math.max(80, Math.min(canvas.width - player.w - 90, player.x));

  const mode = RUN_MODES[world.selectedMode] || RUN_MODES.normal;
  world.offsetX += (level.baseSpeed + Math.max(0, player.vx * 0.55)) * BASE_SCROLL_SPEED_MULTIPLIER * mode.scrollMultiplier;
  world.score += level.baseSpeed * 0.13 + Math.max(0, player.vx * 0.05);

  if (keys.jump && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  if (world.dropThroughTimer > 0) {
    world.dropThroughTimer -= 1;
  }

  if (keys.down && player.onGround && world.standingOnPlatform) {
    world.dropThroughTimer = 12;
    player.onGround = false;
    player.y += 4;
  }

  player.vy += GRAVITY;
  player.y += player.vy;

  resolveCollisions(previousX, previousY);
  handleStarCollection();
  updateEnemies();
  handleEnemyCollisions(previousY);

  if (world.gameOver) return;

  if (player.y > canvas.height + 120) {
    finalizeRun(false);
    return;
  }

  if (level.hasPipe && isAtPipe() && keys.down) {
    world.score += PIPE_BONUS;
    world.transitioning = true;
    world.transitionTimer = 72;
    world.nextLevelIndex = Math.min(LEVELS.length - 1, world.currentLevelIndex + 1);
    return;
  }

  if (level.hasFlag && world.flag && world.offsetX >= world.flag.x - 60) {
    world.score += WIN_BONUS;
    finalizeRun(true);
  }
}

function drawBackground() {
  ctx.fillStyle = "#ffd66b";
  ctx.beginPath();
  ctx.arc(140, 96, 44, 0, Math.PI * 2);
  ctx.fill();

  const hillDrift = (world.offsetX * 0.35) % 1800;
  const hillBands = [
    { y: 360, color: "#8ed796", size: 90, drift: 1.15 },
    { y: 386, color: "#84d18d", size: 105, drift: 0.98 },
    { y: 412, color: "#79c982", size: 120, drift: 0.82 },
    { y: 438, color: "#6fc178", size: 135, drift: 0.68 },
  ];

  for (const band of hillBands) {
    ctx.fillStyle = band.color;
    for (let i = -4; i < 12; i += 1) {
      const spacing = 150;
      const hx = i * spacing - (hillDrift * band.drift) % spacing;
      ctx.beginPath();
      ctx.ellipse(hx + spacing * 0.5, band.y, band.size, band.size * 0.44, 0, Math.PI, 0);
      ctx.lineTo(hx + spacing, canvas.height);
      ctx.lineTo(hx, canvas.height);
      ctx.closePath();
      ctx.fill();
    }
  }

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
  const y = world.pipe.groundY - world.pipe.height;

  ctx.fillStyle = "#1f9a38";
  ctx.fillRect(x, y + 10, world.pipe.width, world.pipe.height - 10);
  ctx.fillStyle = "#35c04f";
  ctx.fillRect(x - 8, y, world.pipe.width + 16, 16);
}

function drawFlag() {
  const level = currentLevel();
  if (!level.hasFlag || !world.flag) return;

  const x = world.flag.x - world.offsetX;
  const poleY = world.flag.groundY - 150;
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(x, poleY, 6, 150);
  ctx.fillStyle = "#f5d742";
  ctx.fillRect(x + 6, poleY + 8, 42, 24);
}

function drawStar() {
  if (!world.star || world.star.collected) return;
  const cx = world.star.x - world.offsetX;
  const cy = world.star.y;

  ctx.fillStyle = "#ffd84d";
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerAngle = outerAngle + Math.PI / 5;
    const ox = cx + Math.cos(outerAngle) * 11;
    const oy = cy + Math.sin(outerAngle) * 11;
    const ix = cx + Math.cos(innerAngle) * 5;
    const iy = cy + Math.sin(innerAngle) * 5;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
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

function drawCharacterSprite(x, y, palette, scale = 1) {
  const s = scale;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = palette.hat;
  ctx.fillRect(8 * s, 0, 22 * s, 14 * s);

  ctx.fillStyle = palette.skin;
  ctx.fillRect(9 * s, 14 * s, 20 * s, 16 * s);

  ctx.fillStyle = palette.suit;
  ctx.fillRect(6 * s, 30 * s, 26 * s, 26 * s);

  ctx.fillStyle = palette.shoes;
  ctx.fillRect(5 * s, 50 * s, 10 * s, 6 * s);
  ctx.fillRect(23 * s, 50 * s, 10 * s, 6 * s);

  ctx.restore();
}

function drawPlayer() {
  const palette = CHARACTER_PALETTES[world.selectedCharacter] || CHARACTER_PALETTES.classic;
  drawCharacterSprite(player.x, player.y, palette, 1);
}

function drawHUD() {
  const level = currentLevel();

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(14, 14, 520, 118);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Segoe UI";
  ctx.fillText(`Score: ${Math.floor(world.score)}`, 24, 42);
  ctx.font = "18px Segoe UI";
  ctx.fillText(`Best: ${world.best}`, 24, 66);
  ctx.fillText(`${level.name}: ${level.objective}`, 24, 91);
  ctx.fillText(`Stars: ${world.collectedStars}`, 300, 66);
  ctx.fillText(`Mode: ${(RUN_MODES[world.selectedMode] || RUN_MODES.normal).name}`, 24, 112);
  ctx.fillText(`Deaths: ${world.deaths}`, 300, 91);

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

  if (world.paused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#e7f1ff";
    ctx.textAlign = "center";
    ctx.font = "bold 50px Segoe UI";
    ctx.fillText("Paused", canvas.width / 2, canvas.height / 2 - 18);
    ctx.font = "24px Segoe UI";
    ctx.fillText("Press R to resume", canvas.width / 2, canvas.height / 2 + 24);
    ctx.textAlign = "start";
  }

  if (world.gameOver || world.won) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffefef";
    ctx.textAlign = "center";
    ctx.font = "bold 46px Segoe UI";
    ctx.fillText(world.won ? "You Beat Mini Plumber Run 1.93!" : "You Lost!", canvas.width / 2, canvas.height / 2 - 30);
    ctx.font = "24px Segoe UI";
    ctx.fillText(world.isNewHighScore ? "New High Score!" : "No new high score", canvas.width / 2, canvas.height / 2 + 6);
    ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 40);
    if (world.menuUnlocked) {
      ctx.fillText("Press M to reopen mode + character select", canvas.width / 2, canvas.height / 2 + 74);
    }
    ctx.textAlign = "start";
  }
}

function drawModeSelectScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f3f7ff";
  ctx.textAlign = "center";
  ctx.font = "bold 42px Segoe UI";
  ctx.fillText("Choose Your Run Mode", canvas.width / 2, 120);
  ctx.font = "22px Segoe UI";
  ctx.fillText("Press 1 for Normal or 2 for Speed Run", canvas.width / 2, 160);

  const cardY = 220;
  const leftX = 220;
  const rightX = 560;

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(leftX, cardY, 180, 220);
  ctx.fillRect(rightX, cardY, 180, 220);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Segoe UI";
  ctx.fillText("1 - Normal", leftX + 90, cardY + 92);
  ctx.font = "18px Segoe UI";
  ctx.fillText("Base side scroll", leftX + 90, cardY + 132);

  ctx.font = "bold 24px Segoe UI";
  ctx.fillText("2 - Speed Run", rightX + 90, cardY + 92);
  ctx.font = "18px Segoe UI";
  ctx.fillText("+20% side scroll", rightX + 90, cardY + 132);
  ctx.textAlign = "start";
}

function drawCharacterSelectScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f3f7ff";
  ctx.textAlign = "center";
  ctx.font = "bold 42px Segoe UI";
  ctx.fillText("Choose Your Character", canvas.width / 2, 120);
  ctx.font = "22px Segoe UI";
  ctx.fillText("Press 1 for Classic or 2 for Green Suit", canvas.width / 2, 160);

  const cardY = 220;
  const leftX = 220;
  const rightX = 560;

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(leftX, cardY, 180, 220);
  ctx.fillRect(rightX, cardY, 180, 220);

  drawCharacterSprite(leftX + 56, cardY + 56, CHARACTER_PALETTES.classic, 2.2);
  drawCharacterSprite(rightX + 56, cardY + 56, CHARACTER_PALETTES.green, 2.2);

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px Segoe UI";
  ctx.fillText("1 - Classic", leftX + 90, cardY + 198);
  ctx.fillText("2 - Green Suit", rightX + 90, cardY + 198);
  ctx.textAlign = "start";
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (world.awaitingModeSelect) {
    drawModeSelectScreen();
    return;
  }

  if (world.awaitingCharacterSelect) {
    drawCharacterSelectScreen();
    return;
  }

  for (const chunk of getVisibleChunks()) {
    drawChunk(chunk);
  }

  drawPipe();
  drawFlag();
  drawStar();
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
  if (world.awaitingModeSelect) {
    if (event.code === "Digit1" || event.code === "Numpad1") chooseMode("normal");
    if (event.code === "Digit2" || event.code === "Numpad2") chooseMode("speed");
    return;
  }

  if (world.awaitingCharacterSelect) {
    if (event.code === "Digit1" || event.code === "Numpad1") chooseCharacter("classic");
    if (event.code === "Digit2" || event.code === "Numpad2") chooseCharacter("green");
    return;
  }

  if (event.code === "ArrowLeft") keys.left = true;
  if (event.code === "ArrowRight") keys.right = true;
  if (event.code === "ArrowUp" || event.code === "Space") keys.jump = true;
  if (event.code === "ArrowDown") keys.down = true;

  if (event.code === "KeyR" && (world.gameOver || world.won)) {
    restartGame();
    return;
  }

  if (event.code === "KeyM" && world.menuUnlocked) {
    startModeSelect();
    return;
  }

  if (event.code === "KeyR") {
    world.paused = !world.paused;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft") keys.left = false;
  if (event.code === "ArrowRight") keys.right = false;
  if (event.code === "ArrowUp" || event.code === "Space") keys.jump = false;
  if (event.code === "ArrowDown") keys.down = false;
});

startModeSelect();
loop();


canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  const cardY = 220;
  const leftX = 220;
  const rightX = 560;
  const w = 180;
  const h = 220;

  if (world.awaitingModeSelect) {
    if (x >= leftX && x <= leftX + w && y >= cardY && y <= cardY + h) chooseMode("normal");
    if (x >= rightX && x <= rightX + w && y >= cardY && y <= cardY + h) chooseMode("speed");
    return;
  }

  if (!world.awaitingCharacterSelect) return;

  if (x >= leftX && x <= leftX + w && y >= cardY && y <= cardY + h) chooseCharacter("classic");
  if (x >= rightX && x <= rightX + w && y >= cardY && y <= cardY + h) chooseCharacter("green");
});
