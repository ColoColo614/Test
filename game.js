const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const keys = {
  left: false,
  right: false,
  jump: false,
};

const GRAVITY = 0.78;
const BASE_SPEED = 3.2;
const MOVE_SPEED = 4.2;
const JUMP_FORCE = -14.2;
const FLOOR_Y = 440;

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
  chunks: [],
};

function createChunk(startX, width, kind = "ground", heightOffset = 0) {
  return {
    x: startX,
    y: FLOOR_Y - heightOffset,
    width,
    height: kind === "ground" ? canvas.height - FLOOR_Y : 20,
    kind,
  };
}

function seedWorld() {
  world.offsetX = 0;
  world.score = 0;
  world.gameOver = false;
  world.chunks = [];

  let x = -100;
  while (x < 2400) {
    const roll = Math.random();

    if (roll < 0.18) {
      x += 80 + Math.random() * 110;
      continue;
    }

    const width = 150 + Math.random() * 230;
    world.chunks.push(createChunk(x, width));

    if (Math.random() < 0.35) {
      const platformWidth = 80 + Math.random() * 120;
      const platformX = x + 30 + Math.random() * Math.max(20, width - 110);
      const height = 100 + Math.random() * 110;
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

function extendWorldIfNeeded() {
  const furthest = Math.max(...world.chunks.map((chunk) => chunk.x + chunk.width));
  if (furthest - world.offsetX > 1700) return;

  let x = furthest;
  for (let i = 0; i < 9; i += 1) {
    if (Math.random() < 0.24) {
      x += 90 + Math.random() * 140;
      continue;
    }

    const width = 140 + Math.random() * 260;
    world.chunks.push(createChunk(x, width));

    if (Math.random() < 0.4) {
      const platformWidth = 90 + Math.random() * 140;
      const platformX = x + 10 + Math.random() * Math.max(15, width - 120);
      const height = 90 + Math.random() * 120;
      world.chunks.push(createChunk(platformX, platformWidth, "platform", height));
    }

    x += width;
  }
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

function update() {
  if (world.gameOver) return;

  const previousY = player.y;

  player.vx = 0;
  if (keys.left) player.vx -= MOVE_SPEED;
  if (keys.right) player.vx += MOVE_SPEED;

  player.x += player.vx;
  player.x = Math.max(80, Math.min(canvas.width - player.w - 90, player.x));

  world.offsetX += BASE_SPEED + Math.max(0, player.vx * 0.55);
  world.score += BASE_SPEED * 0.12 + Math.max(0, player.vx * 0.05);

  if (keys.jump && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  player.vy += GRAVITY;
  player.y += player.vy;

  resolveCollisions(previousY);
  extendWorldIfNeeded();

  if (player.y > canvas.height + 120) {
    world.gameOver = true;
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
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(14, 14, 210, 64);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Segoe UI";
  ctx.fillText(`Score: ${Math.floor(world.score)}`, 24, 42);
  ctx.font = "18px Segoe UI";
  ctx.fillText(`Best: ${world.best}`, 24, 66);

  if (world.gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffefef";
    ctx.textAlign = "center";
    ctx.font = "bold 48px Segoe UI";
    ctx.fillText("You Fell!", canvas.width / 2, canvas.height / 2 - 18);
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

  if (event.code === "KeyR" && world.gameOver) {
    seedWorld();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft") keys.left = false;
  if (event.code === "ArrowRight") keys.right = false;
  if (event.code === "ArrowUp" || event.code === "Space") keys.jump = false;
});

seedWorld();
loop();
