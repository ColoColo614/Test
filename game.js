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
const BASE_SCROLL_SPEED_MULTIPLIER = 1;
const HARD_MODE_SCROLL_MULTIPLIER = 1.2;
const HARD_MODE_ENEMY_MULTIPLIER = 1.1;
const HARD_MODE_SCORE_MULTIPLIER = 1.1;
const JUMP_FORCE = -17.75;
const FLOOR_Y = 440;

const SAFE_GAP_MIN = 88;
const SAFE_GAP_MAX = 330;
const SAFE_PLATFORM_HEIGHT_MAX = 180;
const SPAWN_SAFE_RUNWAY = 560;
const STOMP_SCORE = 120;
const PIPE_BONUS = 220;
const WIN_BONUS = 1500;
const VENUS_PIPE_SCALE = 0.6;
const VENUS_CYCLE_FRAMES = 180;

const LEVELS = [
  {
    id: 1,
    name: "Level 1",
    baseSpeed: 3.0,
    levelLength: 3278,
    objective: "Reach the pipe and press ↓",
    hasPipe: true,
    hasFlag: false,
    enemyCount: 3,
  },
  {
    id: 2,
    name: "Level 2",
    baseSpeed: 3.45,
    levelLength: 3738,
    objective: "Use the second pipe to descend",
    hasPipe: true,
    hasFlag: false,
    enemyCount: 5,
    enemyIncreaseRate: 0.05,
  },
  {
    id: 3,
    name: "Level 3",
    baseSpeed: 3.85,
    levelLength: 4284,
    objective: "Reach the third pipe",
    hasPipe: true,
    hasFlag: false,
    enemyCount: 7,
    enemyIncreaseRate: 0.1,
  },
  {
    id: 4,
    name: "Level 4",
    baseSpeed: 4.15,
    levelLength: 4830,
    objective: "Reach the fourth pipe",
    hasPipe: true,
    hasFlag: false,
    enemyCount: 8,
    enemyIncreaseRate: 0.15,
    enemySpeedMultiplier: 1.32,
  },
  {
    id: 5,
    name: "Level 5",
    baseSpeed: 4.35,
    levelLength: 5152,
    objective: "Reach the final flag on land",
    hasPipe: false,
    hasFlag: true,
    enemyCount: 10,
    enemyIncreaseRate: 0.2,
    enemySpeedMultiplier: 1.5972,
  },
];

const CHARACTER_PALETTES = {
  classic: {
    name: "Mario",
    hat: "#d8342a",
    skin: "#f4be97",
    suit: "#223f9e",
    shoes: "#73301f",
    body: "normal",
  },
  green: {
    name: "Luigi",
    hat: "#1f8f3a",
    skin: "#f4be97",
    suit: "#2fbe57",
    shoes: "#5b3a1f",
    body: "verySkinny",
  },
  yellow: {
    name: "Wario",
    hat: "#f0c21a",
    skin: "#f1c49f",
    suit: "#e6b61c",
    shoes: "#6a4a22",
    body: "fat",
  },
  purple: {
    name: "Waluigi",
    hat: "#7e4cc9",
    skin: "#efc09a",
    suit: "#9658dd",
    shoes: "#4f346f",
    body: "skinny",
  },
};

const RUN_MODES = {
  normal: {
    name: "Normal Run",
    scrollMultiplier: 1,
    enemyMultiplier: 1,
    moveMultiplier: 1,
  },
  hard: {
    name: "Hard Mode",
    scrollMultiplier: HARD_MODE_SCROLL_MULTIPLIER,
    enemyMultiplier: 1,
    moveMultiplier: 1,
  },
  easy: {
    name: "Easy Mode",
    scrollMultiplier: 0.8,
    enemyMultiplier: 0.9,
    moveMultiplier: 0.85,
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
  attempts: 0,
  hills: [],
  castle: null,
  flytraps: [],
  isNight: false,
};

function currentLevel() {
  return LEVELS[world.currentLevelIndex];
}

function currentMode() {
  return RUN_MODES[world.selectedMode] || RUN_MODES.normal;
}

function addScore(points) {
  const speedBonus = world.selectedMode === "hard" ? HARD_MODE_SCORE_MULTIPLIER : 1;
  world.score += points * speedBonus;
}

function finalizeRun(gameWon) {
  const finalScore = Math.floor(world.score);
  world.isNewHighScore = finalScore > world.best;
  world.best = Math.max(world.best, finalScore);
  world.won = gameWon;
  world.gameOver = !gameWon;

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

function removePlatformsAbovePipe(chunks, pipe) {
  if (!pipe) return chunks;
  const pad = 10;
  const pipeLeft = pipe.x - pad;
  const pipeRight = pipe.x + pipe.width + pad;

  return chunks.filter((chunk) => {
    if (chunk.kind !== "platform") return true;
    const overlapsPipe = chunk.x < pipeRight && chunk.x + chunk.width > pipeLeft;
    const isAboveGround = chunk.y < pipe.groundY;
    if (overlapsPipe && isAboveGround) return false;
    return true;
  });
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

function placeStar(level, chunks, pipe, flag) {
  const objectiveX = pipe ? pipe.x : flag ? flag.x : level.levelLength;
  const maxStarX = objectiveX - 180;

  const platforms = chunks.filter((chunk) => chunk.kind === "platform" && chunk.y < FLOOR_Y - 120 && chunk.x + chunk.width <= maxStarX);
  const fallbackGround = chunks.filter(
    (chunk) => chunk.kind === "ground" && chunk.x > level.levelLength * 0.45 && chunk.x + chunk.width <= maxStarX,
  );
  const pool = platforms.length ? platforms : fallbackGround;
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

  const mode = currentMode();
  const hardModeEnemyBoost = world.selectedMode === "hard" && level.id <= 4 ? HARD_MODE_ENEMY_MULTIPLIER : 1;
  const speedMultiplier = (level.enemySpeedMultiplier || 1) * hardModeEnemyBoost * mode.enemyMultiplier;
  const expectedEnemyCount = level.enemyCount * (1 + (level.enemyIncreaseRate || 0));
  const targetEnemyCount = Math.max(1, Math.floor(expectedEnemyCount) + (Math.random() < expectedEnemyCount % 1 ? 1 : 0));
  const step = Math.max(1, Math.floor(candidates.length / targetEnemyCount));

  for (let i = 0; i < candidates.length && enemies.length < targetEnemyCount; i += step) {
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

function buildFlytraps(level, chunks, objectiveX) {
  const flytraps = [];
  const hazardPipeWidth = Math.round(64 * VENUS_PIPE_SCALE);
  const hazardPipeHeight = Math.round(86 * VENUS_PIPE_SCALE);
  const candidates = chunks
    .filter(
      (chunk) =>
        chunk.kind === "ground" &&
        chunk.width > 170 &&
        chunk.x > 460 &&
        chunk.x + chunk.width < objectiveX - 110,
    )
    .sort((a, b) => a.x - b.x);

  const targetCount = Math.max(1, Math.min(4, 1 + Math.floor(level.id * 0.75)));
  const step = Math.max(1, Math.floor(candidates.length / targetCount));

  for (let i = 0; i < candidates.length && flytraps.length < targetCount; i += step) {
    const chunk = candidates[i];
    const x = chunk.x + Math.min(chunk.width - hazardPipeWidth - 18, 18 + Math.random() * 64);

    const hasTrap = Math.random() < 0.72;
    flytraps.push({
      x,
      groundY: chunk.y,
      pipeWidth: hazardPipeWidth,
      pipeHeight: hazardPipeHeight,
      headWidth: 28,
      headHeight: 28,
      hasTrap,
      emerge: 0,
      visible: hasTrap ? Math.random() < 0.5 : false,
      timer: Math.floor(Math.random() * VENUS_CYCLE_FRAMES),
    });
  }

  return flytraps;
}

function startModeSelect() {
  world.awaitingModeSelect = true;
  world.awaitingCharacterSelect = false;
  world.selectedMode = null;
  world.selectedCharacter = null;
  world.paused = false;
}

function startCharacterSelect() {
  if (!world.selectedMode) return;
  world.awaitingModeSelect = false;
  world.awaitingCharacterSelect = true;
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

function limitTerrainAfterObjective(chunks, objectiveX) {
  const sortedGround = chunks.filter((chunk) => chunk.kind === "ground").sort((a, b) => a.x - b.x);
  const objectiveGround = sortedGround.find((chunk) => objectiveX >= chunk.x && objectiveX <= chunk.x + chunk.width);
  if (!objectiveGround) return chunks.filter((chunk) => chunk.kind === "ground" || chunk.x <= objectiveX);

  const objectiveGroundEnd = objectiveGround.x + objectiveGround.width;
  const postObjectiveChunk = sortedGround.find((chunk) => chunk.x >= objectiveGroundEnd - 1);

  if (!postObjectiveChunk || postObjectiveChunk === objectiveGround) {
    return chunks.filter((chunk) => chunk.kind === "ground" && chunk.x <= objectiveGround.x + 1);
  }

  postObjectiveChunk.x = objectiveGroundEnd;
  const endX = postObjectiveChunk.x + postObjectiveChunk.width;

  return chunks.filter((chunk) => {
    if (chunk.kind === "platform" && chunk.x + chunk.width > objectiveX) return false;
    return chunk.x < endX;
  });
}

function buildCastle(chunks) {
  const lastGround = [...chunks].filter((chunk) => chunk.kind === "ground").sort((a, b) => b.x - a.x)[0];
  if (!lastGround) return null;

  const width = 82;
  const height = 74;
  const x = lastGround.x + Math.max(8, lastGround.width - width - 10);
  const y = lastGround.y - height;
  return { x, y, width, height };
}

function buildRandomHills(level) {
  const hills = [];
  const count = 12 + level.id * 3;
  const maxX = level.levelLength + canvas.width + 400;

  for (let i = 0; i < count; i += 1) {
    hills.push({
      x: Math.random() * maxX - 300,
      y: 330 + Math.random() * 120,
      width: 120 + Math.random() * 170,
      depth: 0.45 + Math.random() * 0.65,
      color: "#4caf50",
    });
  }

  return hills.sort((a, b) => a.depth - b.depth);
}

function buildLevel(level) {
  world.offsetX = 0;
  world.chunks = generateSafeTerrain(level);
  world.pipe = placePipeOnLand(level, world.chunks);
  world.chunks = removePlatformsAbovePipe(world.chunks, world.pipe);
  world.flag = placeFlagOnLand(level, world.chunks);

  const objectiveX = world.pipe ? world.pipe.x : world.flag ? world.flag.x : level.levelLength;
  world.chunks = limitTerrainAfterObjective(world.chunks, objectiveX);
  world.enemies = buildEnemies(level, world.chunks);
  world.flytraps = buildFlytraps(level, world.chunks, objectiveX);
  world.star = placeStar(level, world.chunks, world.pipe, world.flag);
  world.hills = buildRandomHills(level);
  world.castle = buildCastle(world.chunks);
  world.isNight = Math.random() < (level.id >= 4 ? 0.55 : 0.35);

  player.x = 180;
  player.y = world.chunks[0].y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
}

function restartGame() {
  world.attempts += 1;
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

function updateFlytraps() {
  for (const trap of world.flytraps) {
    if (!trap.hasTrap) {
      trap.emerge = 0;
      continue;
    }

    trap.timer -= 1;
    if (trap.timer <= 0) {
      trap.visible = !trap.visible;
      trap.timer = VENUS_CYCLE_FRAMES;
    }

    const targetEmerge = trap.visible ? 1 : 0;
    trap.emerge += (targetEmerge - trap.emerge) * 0.08;
  }
}

function handleFlytrapCollisions() {
  const playerRect = playerEnemyWorldRect();

  for (const trap of world.flytraps) {
    if (!trap.hasTrap || trap.emerge < 0.18) continue;

    const centerX = trap.x + trap.pipeWidth / 2;
    const headW = trap.headWidth;
    const headH = trap.headHeight;
    const topY = trap.groundY - trap.pipeHeight - headH * trap.emerge;
    const left = centerX - headW / 2;
    const right = centerX + headW / 2;
    const bottom = topY + headH;

    const touching =
      playerRect.right > left &&
      playerRect.left < right &&
      playerRect.bottom > topY &&
      playerRect.top < bottom;

    if (touching) {
      finalizeRun(false);
      return;
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
      addScore(STOMP_SCORE);
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
    addScore(world.star.value);
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
  const mode = currentMode();
  const previousX = player.x;
  const previousY = player.y;

  player.vx = 0;
  const moveMultiplier = mode.moveMultiplier || 1;
  if (keys.left) player.vx -= MOVE_SPEED * BACKWARD_SPEED_MULTIPLIER * moveMultiplier;
  if (keys.right) player.vx += MOVE_SPEED * moveMultiplier;

  player.x += player.vx;
  player.x = Math.max(80, Math.min(canvas.width - player.w - 90, player.x));

  world.offsetX += (level.baseSpeed + Math.max(0, player.vx * 0.55)) * BASE_SCROLL_SPEED_MULTIPLIER * mode.scrollMultiplier;
  addScore(level.baseSpeed * 0.13 + Math.max(0, player.vx * 0.05));

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
  updateFlytraps();
  handleEnemyCollisions(previousY);
  handleFlytrapCollisions();

  if (world.gameOver) return;

  if (player.y > canvas.height + 120) {
    finalizeRun(false);
    return;
  }

  if (level.hasPipe && isAtPipe() && keys.down) {
    addScore(PIPE_BONUS);
    world.transitioning = true;
    world.transitionTimer = 72;
    world.nextLevelIndex = Math.min(LEVELS.length - 1, world.currentLevelIndex + 1);
    return;
  }

  if (level.hasFlag && world.flag && world.offsetX >= world.flag.x - 60) {
    addScore(WIN_BONUS);
    finalizeRun(true);
  }
}

function drawBackground() {
  const levelId = currentLevel().id;
  const themes = {
    1: {
      sun: "#ffd66b",
      hill: "#4caf50",
      cloud: "rgba(255,255,255,0.95)",
    },
    2: {
      sun: "#f6bf5c",
      hill: "#c8a35a",
      cloud: "rgba(255,240,210,0.88)",
    },
    3: {
      sun: "#e6ecff",
      hill: "#6f7a8d",
      cloud: "rgba(230,238,255,0.9)",
    },
    4: {
      sun: "#fff2a8",
      hill: "#3bb868",
      cloud: "rgba(236,255,236,0.92)",
    },
    5: {
      sun: "#cf66d8",
      hill: "#5d376f",
      cloud: "rgba(198,160,230,0.55)",
    },
  };
  const theme = themes[levelId] || themes[1];

  const skyBody = world.isNight
    ? ctx.createLinearGradient(0, 0, 0, canvas.height)
    : null;
  if (skyBody) {
    skyBody.addColorStop(0, "rgba(10, 20, 45, 0.8)");
    skyBody.addColorStop(1, "rgba(25, 35, 70, 0.35)");
    ctx.fillStyle = skyBody;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = world.isNight ? "#d8e6ff" : theme.sun;
  ctx.beginPath();
  ctx.arc(140, 96, 44, 0, Math.PI * 2);
  ctx.fill();

  for (const hill of world.hills) {
    const x = hill.x - world.offsetX * hill.depth;
    const wrappedX = ((x % 1800) + 1800) % 1800 - 300;
    const y = hill.y;

    ctx.fillStyle = world.isNight ? "#2a3f35" : theme.hill;
    ctx.beginPath();
    ctx.ellipse(wrappedX + hill.width, y, hill.width, hill.width * 0.28, 0, Math.PI, 0);
    ctx.lineTo(wrappedX + hill.width * 2, canvas.height);
    ctx.lineTo(wrappedX, canvas.height);
    ctx.closePath();
    ctx.fill();
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

    ctx.fillStyle = world.isNight ? "rgba(200,210,230,0.45)" : theme.cloud;
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
    const dirtGradient = ctx.createLinearGradient(0, chunk.y, 0, canvas.height);
    dirtGradient.addColorStop(0, "#7a5635");
    dirtGradient.addColorStop(1, "#4f351f");
    ctx.fillStyle = dirtGradient;
    ctx.fillRect(x, chunk.y, chunk.width, chunk.height);

    ctx.fillStyle = "#3f9d4f";
    ctx.fillRect(x, chunk.y - 10, chunk.width, 10);
    ctx.fillStyle = "#73c57d";
    ctx.fillRect(x, chunk.y - 10, chunk.width, 3);
    return;
  }

  ctx.fillStyle = "#9a3a2a";
  ctx.fillRect(x, chunk.y, chunk.width, chunk.height);
  ctx.fillStyle = "#bd5b45";
  ctx.fillRect(x + 2, chunk.y + 2, chunk.width - 4, chunk.height - 4);

  ctx.strokeStyle = "rgba(71, 22, 14, 0.65)";
  ctx.lineWidth = 2;
  const rowA = chunk.y + 7;
  const rowB = chunk.y + 14;
  ctx.beginPath();
  ctx.moveTo(x + 1, rowA);
  ctx.lineTo(x + chunk.width - 1, rowA);
  ctx.moveTo(x + 1, rowB);
  ctx.lineTo(x + chunk.width - 1, rowB);
  for (let bx = x + 14; bx < x + chunk.width - 4; bx += 28) {
    ctx.moveTo(bx, chunk.y + 2);
    ctx.lineTo(bx, rowA);
  }
  for (let bx = x + 28; bx < x + chunk.width - 4; bx += 28) {
    ctx.moveTo(bx, rowA);
    ctx.lineTo(bx, rowB);
  }
  ctx.stroke();
}

function drawPipe() {
  if (!world.pipe) return;

  const x = world.pipe.x - world.offsetX;
  const y = world.pipe.groundY - world.pipe.height;

  const bodyGradient = ctx.createLinearGradient(x, y, x + world.pipe.width, y);
  bodyGradient.addColorStop(0, "#2db54e");
  bodyGradient.addColorStop(1, "#1b7f33");
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(x, y + 10, world.pipe.width, world.pipe.height - 10);

  ctx.fillStyle = "#35c04f";
  ctx.fillRect(x - 8, y, world.pipe.width + 16, 16);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x - 6, y + 2, world.pipe.width * 0.42, 4);
}

function drawFlytraps() {
  for (const trap of world.flytraps) {
    const pipeX = trap.x - world.offsetX;
    const pipeY = trap.groundY - trap.pipeHeight;

    if (trap.hasTrap && trap.emerge >= 0.12) {
      const centerX = pipeX + trap.pipeWidth / 2;
      const headW = trap.headWidth;
      const headH = trap.headHeight;
      const headY = pipeY - headH * trap.emerge;
      const mouthOpen = 2 + Math.abs(Math.sin(performance.now() * 0.01)) * 6;

      // Stem first (will be partially hidden by pipe cap drawn later)
      ctx.fillStyle = "#2f8e39";
      ctx.fillRect(centerX - 4, pipeY - 2, 8, -(headH * trap.emerge - 2));

      // Green Venus flytrap jaws
      ctx.fillStyle = "#3faa45";
      ctx.beginPath();
      ctx.ellipse(centerX - 4, headY + 15, headW * 0.32, headH * 0.28, -0.22, 0, Math.PI * 2);
      ctx.ellipse(centerX + 4, headY + 15, headW * 0.32, headH * 0.28, 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#9de59c";
      ctx.beginPath();
      ctx.ellipse(centerX - 2.5, headY + 15, headW * 0.18, headH * 0.16, -0.22, 0, Math.PI * 2);
      ctx.ellipse(centerX + 2.5, headY + 15, headW * 0.18, headH * 0.16, 0.22, 0, Math.PI * 2);
      ctx.fill();

      // Mouth opening line
      ctx.strokeStyle = "#183518";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 7, headY + 14 - mouthOpen * 0.2);
      ctx.lineTo(centerX + 7, headY + 14 + mouthOpen * 0.2);
      ctx.stroke();

      // Teeth around mouth edge
      ctx.fillStyle = "#f7fff6";
      for (let i = -6; i <= 6; i += 3) {
        ctx.fillRect(centerX + i - 0.6, headY + 11 - mouthOpen * 0.25, 1.2, 4);
        ctx.fillRect(centerX + i - 0.6, headY + 17 + mouthOpen * 0.05, 1.2, 4);
      }

      // Eye detail
      ctx.fillStyle = "#1f2a1f";
      ctx.fillRect(centerX + 5, headY + 10, 2, 2);
    }

    const bodyGradient = ctx.createLinearGradient(pipeX, pipeY, pipeX + trap.pipeWidth, pipeY);
    bodyGradient.addColorStop(0, "#2db54e");
    bodyGradient.addColorStop(1, "#1b7f33");
    ctx.fillStyle = bodyGradient;
    ctx.fillRect(pipeX, pipeY + 6, trap.pipeWidth, trap.pipeHeight - 6);
    ctx.fillStyle = "#3cc95a";
    ctx.fillRect(pipeX - 5, pipeY, trap.pipeWidth + 10, 10);
  }
}

function drawCastle() {
  if (!world.castle) return;

  const x = world.castle.x - world.offsetX;
  const y = world.castle.y;
  const { width, height } = world.castle;

  const wallGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  wallGradient.addColorStop(0, "#a2a2b3");
  wallGradient.addColorStop(1, "#6c6c7f");
  ctx.fillStyle = wallGradient;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "#5f5f70";
  const crenelW = 10;
  for (let i = 0; i < width; i += crenelW + 3) {
    ctx.fillRect(x + i, y - 10, crenelW, 10);
  }

  ctx.fillStyle = "#4f4f5d";
  ctx.fillRect(x + 30, y + height - 36, 22, 36);
  ctx.fillStyle = "#2d2d37";
  ctx.fillRect(x + 35, y + height - 28, 4, 10);
  ctx.fillRect(x + 43, y + height - 28, 4, 10);

  ctx.fillStyle = "#7d7d8f";
  ctx.fillRect(x + 6, y - 20, 17, 24);
  ctx.fillRect(x + width - 23, y - 20, 17, 24);

  ctx.fillStyle = "#31313d";
  ctx.fillRect(x + 14, y + 20, 8, 12);
  ctx.fillRect(x + width - 22, y + 20, 8, 12);

  ctx.fillStyle = "#b5162c";
  ctx.fillRect(x + width - 8, y - 34, 3, 24);
  ctx.beginPath();
  ctx.moveTo(x + width - 5, y - 34);
  ctx.lineTo(x + width + 11, y - 29);
  ctx.lineTo(x + width - 5, y - 24);
  ctx.closePath();
  ctx.fill();
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

    ctx.fillStyle = "#9e6035";
    ctx.fillRect(x + 2, enemy.y, enemy.w - 4, 16);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x + 5, enemy.y + 2, enemy.w - 12, 3);

    ctx.fillStyle = "#1d1d1d";
    ctx.fillRect(x + 8, enemy.y + 6, 4, 4);
    ctx.fillRect(x + 20, enemy.y + 6, 4, 4);
  }
}

function drawCharacterSprite(x, y, palette, scale = 1, animated = false) {
  const s = scale;
  const time = animated ? performance.now() * 0.028 : 0;
  const legPhase = animated ? Math.sin(time) : 0;
  const armPhase = animated ? Math.sin(time + Math.PI) : 0;

  const bodyScale = palette.body === "fat" ? 1.18 : palette.body === "skinny" ? 0.84 : palette.body === "verySkinny" ? 0.6 : 1;
  const torsoW = 16 * s * bodyScale;
  const torsoX = 12 * s - torsoW / 2;

  ctx.save();
  ctx.translate(x, y);

  // Side-view hat and brim
  ctx.fillStyle = palette.hat;
  ctx.fillRect(6 * s, 2 * s, 20 * s, 10 * s);
  ctx.fillRect(18 * s, 10 * s, 10 * s, 3 * s);

  // Head side profile
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.roundRect(9 * s, 13 * s, 16 * s, 14 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = "#1f1410";
  ctx.fillRect(19 * s, 19 * s, 2 * s, 2 * s);
  ctx.fillStyle = "#6a3c23";
  ctx.fillRect(18 * s, 24 * s, 6 * s, 2 * s);

  // Torso/overalls (side view)
  ctx.fillStyle = palette.suit;
  ctx.fillRect(torsoX, 28 * s, torsoW, 20 * s);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(torsoX + 1.5 * s, 29 * s, torsoW * 0.36, 3 * s);

  // Arm swing
  ctx.fillStyle = palette.skin;
  ctx.fillRect(8 * s + armPhase * 1.2 * s, 31 * s + Math.abs(armPhase) * 0.6 * s, 4 * s, 11 * s);

  // Legs under torso with stride
  const hipX = 14.2 * s;
  const upperY = 48 * s;
  const stepA = legPhase * 2.2 * s;
  const stepB = -legPhase * 2.2 * s;
  ctx.fillStyle = palette.suit;
  ctx.fillRect(hipX - 3 * s + stepA * 0.35, upperY, 4 * s, 5.2 * s);
  ctx.fillRect(hipX + 2 * s + stepB * 0.35, upperY, 4 * s, 5.2 * s);

  // Lower legs + shoes for more realistic run cycle
  ctx.fillRect(hipX - 4.5 * s + stepA * 0.75, upperY + 4.6 * s, 4 * s, 4.6 * s);
  ctx.fillRect(hipX + 3.5 * s + stepB * 0.75, upperY + 4.6 * s, 4 * s, 4.6 * s);

  ctx.fillStyle = palette.shoes;
  ctx.fillRect(hipX - 5.2 * s + stepA, upperY + 9 * s, 6.6 * s, 3.6 * s);
  ctx.fillRect(hipX + 3.2 * s + stepB, upperY + 9 * s, 6.6 * s, 3.6 * s);

  ctx.restore();
}

function drawPlayer() {
  const palette = CHARACTER_PALETTES[world.selectedCharacter] || CHARACTER_PALETTES.classic;
  drawCharacterSprite(player.x, player.y, palette, 1, true);
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
  ctx.fillText(`Mode: ${currentMode().name}`, 24, 112);
  ctx.fillText(`Attempts: ${world.attempts}`, 300, 91);

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
    ctx.fillText(world.won ? "You Beat mini plumber run vrs 1.9.9.1!" : "You Lost!", canvas.width / 2, canvas.height / 2 - 30);
    ctx.font = "24px Segoe UI";
    if (world.isNewHighScore) {
      ctx.fillText("New High Score!", canvas.width / 2, canvas.height / 2 + 6);
    }
    ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 40);
    ctx.fillText("Press M to change mode or C to change character", canvas.width / 2, canvas.height / 2 + 74);
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
  ctx.fillText("Press 1 for Normal, 2 for Hard, or 3 for Easy", canvas.width / 2, 160);

  const cardY = 220;
  const leftX = 90;
  const centerX = 390;
  const rightX = 690;

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(leftX, cardY, 180, 220);
  ctx.fillRect(centerX, cardY, 180, 220);
  ctx.fillRect(rightX, cardY, 180, 220);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Segoe UI";
  ctx.fillText("1 - Normal", leftX + 90, cardY + 84);
  ctx.font = "17px Segoe UI";
  ctx.fillText("Standard", leftX + 90, cardY + 120);

  ctx.font = "bold 24px Segoe UI";
  ctx.fillText("2 - Hard Mode", centerX + 90, cardY + 84);
  ctx.font = "17px Segoe UI";
  ctx.fillText("+20% scroll", centerX + 90, cardY + 120);
  ctx.fillText("+10% score", centerX + 90, cardY + 146);

  ctx.font = "bold 24px Segoe UI";
  ctx.fillText("3 - Easy Mode", rightX + 90, cardY + 84);
  ctx.font = "17px Segoe UI";
  ctx.fillText("-20% scroll", rightX + 90, cardY + 120);
  ctx.fillText("-10% enemy speed", rightX + 90, cardY + 146);
  ctx.fillText("-15% move speed", rightX + 90, cardY + 172);
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
  ctx.fillText("Press 1/2/3/4 for character selection", canvas.width / 2, 160);

  const cardY = 210;
  const cardW = 160;
  const gap = 40;
  const startX = 80;
  const xs = [startX, startX + cardW + gap, startX + (cardW + gap) * 2, startX + (cardW + gap) * 3];

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (const cx of xs) ctx.fillRect(cx, cardY, cardW, 230);

  drawCharacterSprite(xs[0] + 48, cardY + 52, CHARACTER_PALETTES.classic, 2.0);
  drawCharacterSprite(xs[1] + 48, cardY + 52, CHARACTER_PALETTES.green, 2.0);
  drawCharacterSprite(xs[2] + 48, cardY + 52, CHARACTER_PALETTES.yellow, 2.0);
  drawCharacterSprite(xs[3] + 48, cardY + 52, CHARACTER_PALETTES.purple, 2.0);

  ctx.fillStyle = "#ffffff";
  ctx.font = "18px Segoe UI";
  ctx.fillText("1 - Mario", xs[0] + 80, cardY + 204);
  ctx.fillText("2 - Luigi", xs[1] + 80, cardY + 204);
  ctx.fillText("3 - Wario", xs[2] + 80, cardY + 204);
  ctx.fillText("4 - Waluigi", xs[3] + 80, cardY + 204);
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

  drawFlytraps();
  drawPipe();
  drawFlag();
  drawCastle();
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
    if (event.code === "Digit2" || event.code === "Numpad2") chooseMode("hard");
    if (event.code === "Digit3" || event.code === "Numpad3") chooseMode("easy");
    return;
  }

  if (world.awaitingCharacterSelect) {
    if (event.code === "Digit1" || event.code === "Numpad1") chooseCharacter("classic");
    if (event.code === "Digit2" || event.code === "Numpad2") chooseCharacter("green");
    if (event.code === "Digit3" || event.code === "Numpad3") chooseCharacter("yellow");
    if (event.code === "Digit4" || event.code === "Numpad4") chooseCharacter("purple");
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

  if (event.code === "KeyM") {
    startModeSelect();
    return;
  }

  if (event.code === "KeyC") {
    startCharacterSelect();
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
  const modeLeftX = 90;
  const modeCenterX = 390;
  const modeRightX = 690;
  const charW = 160;
  const charH = 230;
  const charStartX = 80;
  const charGap = 40;
  const charXs = [charStartX, charStartX + charW + charGap, charStartX + (charW + charGap) * 2, charStartX + (charW + charGap) * 3];
  const w = 180;
  const h = 220;

  if (world.awaitingModeSelect) {
    if (x >= modeLeftX && x <= modeLeftX + w && y >= cardY && y <= cardY + h) chooseMode("normal");
    if (x >= modeCenterX && x <= modeCenterX + w && y >= cardY && y <= cardY + h) chooseMode("hard");
    if (x >= modeRightX && x <= modeRightX + w && y >= cardY && y <= cardY + h) chooseMode("easy");
    return;
  }

  if (!world.awaitingCharacterSelect) return;

  if (x >= charXs[0] && x <= charXs[0] + charW && y >= 210 && y <= 210 + charH) chooseCharacter("classic");
  if (x >= charXs[1] && x <= charXs[1] + charW && y >= 210 && y <= 210 + charH) chooseCharacter("green");
  if (x >= charXs[2] && x <= charXs[2] + charW && y >= 210 && y <= 210 + charH) chooseCharacter("yellow");
  if (x >= charXs[3] && x <= charXs[3] + charW && y >= 210 && y <= 210 + charH) chooseCharacter("purple");
});
