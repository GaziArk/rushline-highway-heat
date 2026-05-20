const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const speedValue = document.querySelector("#speedValue");
const scoreValue = document.querySelector("#scoreValue");
const distanceValue = document.querySelector("#distanceValue");
const comboValue = document.querySelector("#comboValue");
const heatFill = document.querySelector("#heatFill");
const objectiveBar = document.querySelector("#objectiveBar");
const runCoinsValue = document.querySelector("#runCoinsValue");
const shieldValue = document.querySelector("#shieldValue");
const startOverlay = document.querySelector("#startOverlay");
const pauseOverlay = document.querySelector("#pauseOverlay");
const resultOverlay = document.querySelector("#resultOverlay");
const startBtn = document.querySelector("#startBtn");
const restartBtn = document.querySelector("#restartBtn");
const garageBtn = document.querySelector("#garageBtn");
const resumeBtn = document.querySelector("#resumeBtn");
const endRunBtn = document.querySelector("#endRunBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const muteBtn = document.querySelector("#muteBtn");
const leftBtn = document.querySelector("#leftBtn");
const rightBtn = document.querySelector("#rightBtn");
const brakeBtn = document.querySelector("#brakeBtn");
const boostBtn = document.querySelector("#boostBtn");
const modeSelect = document.querySelector("#modeSelect");
const carSelect = document.querySelector("#carSelect");
const carStats = document.querySelector("#carStats");
const bankCoinsValue = document.querySelector("#bankCoinsValue");
const bestScoreValue = document.querySelector("#bestScoreValue");
const resultKicker = document.querySelector("#resultKicker");
const resultTitle = document.querySelector("#resultTitle");
const finalScore = document.querySelector("#finalScore");
const finalDistance = document.querySelector("#finalDistance");
const finalNearMisses = document.querySelector("#finalNearMisses");
const finalCoins = document.querySelector("#finalCoins");
const finalBestScore = document.querySelector("#finalBestScore");
const finalRunTime = document.querySelector("#finalRunTime");

const LANES = 4;
const ROAD_MARGIN = 0.11;
const SAVE_KEY = "rushline-highway-heat-save-v2";
const MAX_UPGRADE_LEVEL = 5;

const BASE_CARS = {
  comet: {
    name: "Comet SX",
    color: "#20c7b4",
    topSpeed: 188,
    acceleration: 42,
    handling: 12.5,
    braking: 92,
    boost: 82,
  },
  vandal: {
    name: "Vandal GT",
    color: "#ffb02e",
    topSpeed: 218,
    acceleration: 48,
    handling: 10.5,
    braking: 78,
    boost: 96,
  },
  atlas: {
    name: "Atlas Runner",
    color: "#4f8cff",
    topSpeed: 176,
    acceleration: 35,
    handling: 9.2,
    braking: 106,
    boost: 70,
  },
};

const UPGRADE_CONFIG = {
  topSpeed: { label: "Engine", short: "Speed", baseCost: 90, step: 8 },
  acceleration: { label: "Turbo", short: "Accel", baseCost: 80, step: 4 },
  handling: { label: "Tires", short: "Grip", baseCost: 70, step: 0.55 },
  braking: { label: "Brakes", short: "Brake", baseCost: 65, step: 7 },
  boost: { label: "Battery", short: "Boost", baseCost: 85, step: 7 },
};

const MODES = {
  endless: {
    label: "Endless Drive",
    density: 1,
    target: 0,
    timeLimit: 0,
  },
  time: {
    label: "Time Attack",
    density: 1.08,
    target: 18000,
    timeLimit: 90,
  },
  challenge: {
    label: "Near Miss Challenge",
    density: 1.15,
    target: 25,
    timeLimit: 0,
  },
};

const TRAFFIC = [
  { type: "sedan", color: "#dbe7ef", speed: [62, 94], width: 0.47, height: 1.75 },
  { type: "taxi", color: "#ffcf4a", speed: [70, 106], width: 0.48, height: 1.72 },
  { type: "van", color: "#9bb0c0", speed: [54, 82], width: 0.56, height: 1.95 },
  { type: "bus", color: "#e46d56", speed: [45, 68], width: 0.62, height: 2.45 },
  { type: "bike", color: "#f4f7fa", speed: [78, 125], width: 0.28, height: 1.18 },
];

let save = loadSave();
let state;
let rafId = 0;
let lastTime = 0;
let audioCtx = null;
let view = { width: 0, height: 0, roadLeft: 0, roadWidth: 0, laneWidth: 0 };
let pointerStart = null;
const input = { brake: false, boost: false };

function createState() {
  const mode = MODES[modeSelect.value];
  const car = getCarStats(carSelect.value);
  return {
    status: "menu",
    pausedFrom: "running",
    mode,
    car,
    speed: 0,
    score: 0,
    distance: 0,
    coins: 0,
    runCoins: 0,
    heat: 0,
    combo: 1,
    boostEnergy: 100,
    lane: 1,
    targetLane: 1,
    playerX: 0,
    playerY: 0,
    playerW: 44,
    playerH: 82,
    roadOffset: 0,
    sceneryOffset: 0,
    traffic: [],
    pickups: [],
    particles: [],
    spawnTimer: 0.9,
    pickupTimer: 1.8,
    nextSpawn: 0.65,
    elapsed: 0,
    countdown: 0,
    grace: 0,
    nearMisses: 0,
    overtakes: 0,
    objectiveComplete: false,
    shield: false,
    boosting: false,
    difficulty: 1,
    shake: 0,
    messageFlash: "",
    messageTimer: 0,
  };
}

function startRun() {
  initAudio();
  state = createState();
  state.status = "countdown";
  state.countdown = 2.8;
  state.targetLane = Math.floor(LANES / 2) - 1;
  state.lane = state.targetLane;
  updatePlayerDimensions();
  state.playerX = laneCenter(state.targetLane);
  state.playerY = view.height * 0.76;
  startOverlay.classList.add("hidden");
  pauseOverlay.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";
  lastTime = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
  playTone(280, 0.08, "triangle", 0.03);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (state.status === "countdown") {
    updateCountdown(dt);
  } else if (state.status === "running") {
    update(dt);
  } else if (state.status === "finished") {
    updateParticles(dt);
  }

  draw();
  updateHud();
  rafId = requestAnimationFrame(loop);
}

function updateCountdown(dt) {
  state.countdown -= dt;
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (state.countdown <= 0) {
    state.status = "running";
    state.grace = 1.25;
    state.messageFlash = "GO";
    state.messageTimer = 0.65;
    playTone(520, 0.12, "square", 0.035);
  }
}

function update(dt) {
  state.elapsed += dt;
  state.grace = Math.max(0, state.grace - dt);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.shake = Math.max(0, state.shake - dt * 18);
  state.difficulty = clamp(1 + state.distance / 2600 + state.elapsed / 210, 1, 2.35);

  const boostActive = input.boost && state.boostEnergy > 1 && state.speed > 72;
  state.boosting = boostActive;
  const targetSpeed = input.brake ? 58 : state.car.topSpeed + (boostActive ? state.car.boost : 0);
  const rate = input.brake ? state.car.braking : state.car.acceleration;
  state.speed = approach(state.speed, targetSpeed, rate * dt);

  if (boostActive) {
    state.boostEnergy = Math.max(0, state.boostEnergy - 31 * dt);
    addSpeedParticles(3);
  } else {
    const regen = input.brake ? 11 : 6.5;
    state.boostEnergy = Math.min(100, state.boostEnergy + regen * dt);
  }

  const targetX = laneCenter(state.targetLane);
  const steerRate = Math.min(1, state.car.handling * dt);
  state.playerX += (targetX - state.playerX) * steerRate;
  state.lane = Math.round((state.playerX - view.roadLeft) / view.laneWidth - 0.5);

  const meters = (state.speed * 1000 / 3600) * dt;
  state.distance += meters;
  state.roadOffset = (state.roadOffset + state.speed * 2.45 * dt) % 80;
  state.sceneryOffset = (state.sceneryOffset + Math.max(90, state.speed * 2.05) * dt) % (view.height + 360);
  state.heat = Math.max(0, state.heat - (boostActive ? 2.5 : 7.2) * dt);
  state.combo = 1 + Math.floor(state.heat / 20) * 0.25;
  state.score += meters * 10 * state.combo;

  spawnTraffic(dt);
  spawnPickups(dt);
  updateTraffic(dt);
  updatePickups(dt);
  updateParticles(dt);
  checkObjectives();
}

function spawnTraffic(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;

  const speedFactor = clamp(state.speed / 170, 0.4, 1.55);
  const density = state.mode.density * state.difficulty;
  state.nextSpawn = clamp((0.98 - speedFactor * 0.18) / density, 0.26, 0.95);
  state.spawnTimer = state.nextSpawn;

  const blockedLanes = new Set(
    state.traffic
      .filter((car) => car.y < view.height * 0.24)
      .map((car) => car.targetLane)
  );

  let openLanes = Array.from({ length: LANES }, (_, lane) => lane).filter((lane) => !blockedLanes.has(lane));
  if (state.elapsed < 3.2) {
    openLanes = openLanes.filter((lane) => lane !== state.targetLane);
  }
  if (!openLanes.length) return;

  const template = TRAFFIC[Math.floor(Math.random() * TRAFFIC.length)];
  const lane = openLanes[Math.floor(Math.random() * openLanes.length)];
  const width = clamp(view.laneWidth * template.width, 24, 62);
  const height = width * template.height;
  const trafficCar = {
    ...template,
    lane,
    targetLane: lane,
    x: laneCenter(lane),
    y: -height - Math.random() * 220,
    w: width,
    h: height,
    speed: random(template.speed[0], template.speed[1] + state.difficulty * 8),
    passed: false,
    nearMissed: false,
    laneShiftTimer: random(2, 5),
  };

  state.traffic.push(trafficCar);
}

function spawnPickups(dt) {
  state.pickupTimer -= dt;
  if (state.pickupTimer > 0 || state.elapsed < 5) return;

  state.pickupTimer = random(1.8, 3.4);
  const lane = Math.floor(Math.random() * LANES);
  const type = Math.random() < 0.78 ? "coin" : "shield";
  const size = type === "coin" ? 19 : 22;
  state.pickups.push({
    type,
    lane,
    x: laneCenter(lane),
    y: -size - random(20, 130),
    r: size,
    collected: false,
    spin: random(0, Math.PI * 2),
  });
}

function updateTraffic(dt) {
  for (const car of state.traffic) {
    car.laneShiftTimer -= dt;
    maybeShiftTrafficLane(car);
    car.x += (laneCenter(car.targetLane) - car.x) * Math.min(1, 3.2 * dt);
    car.y += Math.max(90, (state.speed - car.speed) * 2.65 + 96) * dt;

    if (state.grace <= 0 && overlaps(playerBox(), carBox(car))) {
      if (handleHit(car)) return;
    }

    if (!car.nearMissed && car.y + car.h > state.playerY - 8 && car.y < state.playerY + state.playerH) {
      const gap = Math.abs(car.x - state.playerX);
      if (gap < view.laneWidth * 0.95 && gap > (car.w + state.playerW) * 0.45) {
        car.nearMissed = true;
        rewardNearMiss(car);
      }
    }

    if (!car.passed && car.y > state.playerY + state.playerH * 0.74) {
      car.passed = true;
      rewardOvertake();
    }
  }

  state.traffic = state.traffic.filter((car) => car.y < view.height + 180);
}

function updatePickups(dt) {
  for (const pickup of state.pickups) {
    pickup.y += Math.max(96, state.speed * 2.55 + 74) * dt;
    pickup.spin += dt * 5;

    if (!pickup.collected && overlapsCircleBox(pickup, playerBox())) {
      pickup.collected = true;
      collectPickup(pickup);
    }
  }

  state.pickups = state.pickups.filter((pickup) => !pickup.collected && pickup.y < view.height + 80);
}

function maybeShiftTrafficLane(car) {
  const chance = 0.012 + state.difficulty * 0.004;
  if (car.laneShiftTimer > 0 || car.y < 60 || Math.random() > chance) return;
  car.laneShiftTimer = random(2.5, 5);
  const direction = Math.random() > 0.5 ? 1 : -1;
  const nextLane = car.targetLane + direction;
  if (nextLane < 0 || nextLane >= LANES) return;
  const laneBusy = state.traffic.some((other) => {
    if (other === car || other.targetLane !== nextLane) return false;
    return Math.abs(other.y - car.y) < 150;
  });
  if (!laneBusy) car.targetLane = nextLane;
}

function rewardNearMiss(car) {
  state.nearMisses += 1;
  state.heat = Math.min(100, state.heat + 18);
  state.score += 650 * state.combo;
  state.messageFlash = "Near Miss";
  state.messageTimer = 0.7;
  state.shake = 2.5;
  addSpark(car.x, state.playerY);
  playTone(420 + state.combo * 55, 0.05, "triangle", 0.025);
}

function rewardOvertake() {
  state.overtakes += 1;
  state.heat = Math.min(100, state.heat + 5);
  state.score += 90 * state.combo;
}

function collectPickup(pickup) {
  if (pickup.type === "coin") {
    const value = Math.round(8 + state.combo * 3);
    state.runCoins += value;
    state.score += 240 * state.combo;
    state.heat = Math.min(100, state.heat + 6);
    state.messageFlash = `+${value} Coins`;
    playTone(640, 0.06, "sine", 0.035);
  } else {
    state.shield = true;
    state.score += 350 * state.combo;
    state.messageFlash = "Shield Ready";
    playTone(320, 0.12, "square", 0.03);
  }
  state.messageTimer = 0.75;
  addSpark(pickup.x, pickup.y);
}

function handleHit(car) {
  if (state.shield) {
    state.shield = false;
    state.grace = 1.25;
    state.speed *= 0.48;
    state.score = Math.max(0, state.score - 220);
    state.shake = 7;
    state.messageFlash = "Shield Saved";
    state.messageTimer = 0.9;
    car.y = view.height + 240;
    addExplosion(state.playerX, state.playerY);
    playTone(170, 0.16, "sawtooth", 0.04);
    return false;
  }

  crash();
  return true;
}

function checkObjectives() {
  if (state.mode === MODES.time) {
    const remaining = Math.max(0, state.mode.timeLimit - state.elapsed);
    if (remaining <= 0) {
      state.objectiveComplete = state.score >= state.mode.target;
      finishRun(state.objectiveComplete ? "Time Attack Cleared" : "Time Expired");
    }
  }

  if (state.mode === MODES.challenge && state.nearMisses >= state.mode.target) {
    state.objectiveComplete = true;
    finishRun("Challenge Cleared");
  }
}

function crash() {
  state.shake = 8;
  addExplosion(state.playerX, state.playerY);
  playTone(90, 0.24, "sawtooth", 0.045);
  finishRun("Crashed");
}

function finishRun(title) {
  if (!["running", "countdown", "paused"].includes(state.status)) return;
  pauseOverlay.classList.add("hidden");
  state.status = "finished";
  state.speed = 0;
  state.boosting = false;
  const bonus = state.objectiveComplete ? 120 : 0;
  state.coins = state.runCoins + Math.floor(state.score / 850) + state.nearMisses * 2 + Math.floor(state.distance / 220) + bonus;

  save.runs += 1;
  save.coins += state.coins;
  save.bestScore = Math.max(save.bestScore, Math.floor(state.score));
  save.bestDistance = Math.max(save.bestDistance, state.distance);
  saveData();
  updateGarageUi();

  resultKicker.textContent = state.objectiveComplete ? "Objective complete" : "Run complete";
  resultTitle.textContent = title;
  finalScore.textContent = Math.floor(state.score).toLocaleString("en-US");
  finalDistance.textContent = (state.distance / 1000).toFixed(2);
  finalNearMisses.textContent = state.nearMisses;
  finalCoins.textContent = state.coins;
  finalBestScore.textContent = save.bestScore.toLocaleString("en-US");
  finalRunTime.textContent = Math.floor(state.elapsed);
  setTimeout(() => resultOverlay.classList.remove("hidden"), 420);
}

function draw() {
  const shakeX = state?.shake ? random(-state.shake, state.shake) : 0;
  const shakeY = state?.shake ? random(-state.shake, state.shake) : 0;
  ctx.save();
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.translate(shakeX, shakeY);
  drawWorld();
  if (state) {
    drawPickups();
    drawTraffic();
    drawPlayer();
    drawParticles();
    drawBoostGauge();
    if (state.status === "countdown") drawCountdownText();
    if (state.messageTimer > 0) drawFlashText(state.messageFlash);
  }
  ctx.restore();
}

function drawWorld() {
  const horizon = view.height * 0.08;
  const gradient = ctx.createLinearGradient(0, 0, 0, view.height);
  gradient.addColorStop(0, "#102337");
  gradient.addColorStop(0.45, "#101923");
  gradient.addColorStop(1, "#070b10");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.width, view.height);

  drawCitySide(0, view.roadLeft - 12, horizon);
  drawCitySide(view.roadLeft + view.roadWidth + 12, view.width, horizon);

  ctx.fillStyle = "#151b21";
  ctx.fillRect(view.roadLeft - 22, 0, view.roadWidth + 44, view.height);
  ctx.fillStyle = "#232a31";
  ctx.fillRect(view.roadLeft, 0, view.roadWidth, view.height);

  const edgeGradient = ctx.createLinearGradient(view.roadLeft, 0, view.roadLeft + view.roadWidth, 0);
  edgeGradient.addColorStop(0, "rgba(255,255,255,0.10)");
  edgeGradient.addColorStop(0.5, "rgba(255,255,255,0)");
  edgeGradient.addColorStop(1, "rgba(255,255,255,0.10)");
  ctx.fillStyle = edgeGradient;
  ctx.fillRect(view.roadLeft, 0, view.roadWidth, view.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(view.roadLeft + 3, 0);
  ctx.lineTo(view.roadLeft + 3, view.height);
  ctx.moveTo(view.roadLeft + view.roadWidth - 3, 0);
  ctx.lineTo(view.roadLeft + view.roadWidth - 3, view.height);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
  ctx.lineWidth = 2;
  ctx.setLineDash([28, 52]);
  ctx.lineDashOffset = state ? state.roadOffset : 0;
  for (let lane = 1; lane < LANES; lane += 1) {
    const x = view.roadLeft + view.laneWidth * lane;
    ctx.beginPath();
    ctx.moveTo(x, -90);
    ctx.lineTo(x, view.height + 90);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  drawRoadSign();
}

function drawCitySide(left, right, horizon) {
  if (right <= left) return;
  const width = right - left;
  ctx.fillStyle = "#0d1722";
  ctx.fillRect(left, horizon, width, view.height - horizon);

  for (let i = 0; i < 12; i += 1) {
    const buildingW = width / 8 + (i % 3) * 7;
    const x = left + ((i * 53 + (state?.roadOffset || 0) * 0.16) % (width + buildingW)) - buildingW;
    const h = 70 + ((i * 37) % 90);
    ctx.fillStyle = i % 2 ? "#122539" : "#172c3d";
    ctx.fillRect(x, horizon - h * 0.2, buildingW, h + view.height);

    ctx.fillStyle = i % 3 ? "rgba(32,199,180,0.28)" : "rgba(255,176,46,0.28)";
    for (let y = horizon + 14; y < view.height; y += 44) {
      ctx.fillRect(x + 9, y, 4, 10);
      ctx.fillRect(x + buildingW - 15, y + 16, 4, 10);
    }
  }
}

function drawRoadSign() {
  if (!state || view.width < 560) return;
  const roadRight = view.roadLeft + view.roadWidth;
  const spacing = 420;
  const startY = -150 + state.sceneryOffset;

  for (let i = -1; i < 3; i += 1) {
    const y = startY + i * spacing;
    if (y < -130 || y > view.height + 120) continue;

    const depth = clamp(y / view.height, 0, 1);
    const scale = 0.58 + depth * 0.48;
    const x = roadRight + 22 + depth * 22;
    const poleTop = y + 24 * scale;
    const poleBottom = y + 104 * scale;
    const signW = 72 * scale;
    const signH = 34 * scale;

    ctx.save();
    ctx.globalAlpha = 0.28 + depth * 0.72;
    ctx.strokeStyle = "rgba(215, 225, 230, 0.72)";
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.beginPath();
    ctx.moveTo(x + signW * 0.5, poleTop);
    ctx.lineTo(x + signW * 0.5, poleBottom);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 176, 46, 0.88)";
    roundRect(x, y, signW, signH, 5 * scale);
    ctx.fill();

    ctx.strokeStyle = "rgba(8, 16, 25, 0.32)";
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.stroke();

    ctx.fillStyle = "#081019";
    ctx.font = `900 ${Math.max(8, 11 * scale)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("RUSH", x + signW / 2, y + 14 * scale);
    ctx.fillText("AHEAD", x + signW / 2, y + 27 * scale);
    ctx.restore();
  }
}

function drawTraffic() {
  for (const car of state.traffic) {
    drawCar(car.x, car.y, car.w, car.h, car.color, false, car.type);
  }
}

function drawPickups() {
  for (const pickup of state.pickups) {
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.rotate(pickup.spin);
    if (pickup.type === "coin") {
      ctx.fillStyle = "#ffcf4a";
      ctx.beginPath();
      ctx.arc(0, 0, pickup.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pickup.r * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#5d3900";
      ctx.font = "900 14px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("C", 0, 1);
    } else {
      ctx.fillStyle = "rgba(79, 140, 255, 0.92)";
      ctx.beginPath();
      ctx.moveTo(0, -pickup.r);
      ctx.lineTo(pickup.r, 0);
      ctx.lineTo(0, pickup.r);
      ctx.lineTo(-pickup.r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPlayer() {
  if (state.shield || state.grace > 0) {
    ctx.save();
    ctx.globalAlpha = state.shield ? 0.95 : 0.34;
    ctx.strokeStyle = state.shield ? "rgba(79, 140, 255, 0.95)" : "rgba(255,255,255,0.62)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(state.playerX, state.playerY, state.playerW * 0.72, state.playerH * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawCar(state.playerX, state.playerY, state.playerW, state.playerH, state.car.color, true, "player");
}

function drawCar(x, y, w, h, color, isPlayer, type) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  roundRect(-w * 0.54, h * 0.4, w * 1.08, h * 0.18, 9);
  ctx.fill();

  const body = ctx.createLinearGradient(0, -h * 0.52, 0, h * 0.52);
  body.addColorStop(0, lighten(color, 0.18));
  body.addColorStop(0.5, color);
  body.addColorStop(1, darken(color, 0.18));
  ctx.fillStyle = body;
  roundRect(-w / 2, -h / 2, w, h, w * 0.18);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.20)";
  roundRect(-w * 0.34, -h * 0.28, w * 0.68, h * 0.22, 7);
  ctx.fill();

  ctx.fillStyle = "rgba(5, 12, 18, 0.58)";
  roundRect(-w * 0.32, h * 0.06, w * 0.64, h * 0.22, 7);
  ctx.fill();

  ctx.fillStyle = "#05080b";
  roundRect(-w * 0.58, -h * 0.32, w * 0.16, h * 0.26, 4);
  roundRect(w * 0.42, -h * 0.32, w * 0.16, h * 0.26, 4);
  roundRect(-w * 0.58, h * 0.16, w * 0.16, h * 0.26, 4);
  roundRect(w * 0.42, h * 0.16, w * 0.16, h * 0.26, 4);
  ctx.fill();

  if (isPlayer) {
    ctx.fillStyle = state.boosting ? "rgba(255, 176, 46, 0.62)" : "rgba(32, 199, 180, 0.38)";
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, h * 0.52);
    ctx.lineTo(0, h * 0.9 + state.speed * 0.08);
    ctx.lineTo(w * 0.22, h * 0.52);
    ctx.closePath();
    ctx.fill();
  } else if (type !== "bike") {
    ctx.fillStyle = "rgba(255, 70, 70, 0.78)";
    ctx.fillRect(-w * 0.3, h * 0.43, w * 0.18, 4);
    ctx.fillRect(w * 0.12, h * 0.43, w * 0.18, 4);
  }

  ctx.restore();
}

function drawBoostGauge() {
  const x = view.width - 28;
  const h = 142;
  const y = view.height - h - 92;
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  roundRect(x, y, 10, h, 999);
  ctx.fill();
  ctx.fillStyle = "#ffb02e";
  const fillH = h * state.boostEnergy / 100;
  roundRect(x, y + h - fillH, 10, fillH, 999);
  ctx.fill();
}

function drawCountdownText() {
  const text = state.countdown > 0.6 ? String(Math.ceil(state.countdown)) : "GO";
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 70px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(255, 176, 46, 0.8)";
  ctx.shadowBlur = 24;
  ctx.fillText(text, view.width / 2, view.height * 0.42);
  ctx.restore();
}

function drawFlashText(text) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, state.messageTimer * 1.8);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(32, 199, 180, 0.8)";
  ctx.shadowBlur = 18;
  ctx.fillText(text, view.width / 2, view.height * 0.36);
  ctx.restore();
}

function addSpark(x, y) {
  for (let i = 0; i < 10; i += 1) {
    state.particles.push({
      x,
      y,
      vx: random(-90, 90),
      vy: random(-160, -40),
      life: random(0.24, 0.5),
      color: Math.random() > 0.5 ? "#20c7b4" : "#ffb02e",
      size: random(2, 4),
    });
  }
}

function addExplosion(x, y) {
  for (let i = 0; i < 32; i += 1) {
    state.particles.push({
      x,
      y,
      vx: random(-190, 190),
      vy: random(-210, 80),
      life: random(0.35, 0.8),
      color: Math.random() > 0.4 ? "#ffb02e" : "#ff4c58",
      size: random(3, 8),
    });
  }
}

function addSpeedParticles(count) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x: state.playerX + random(-state.playerW * 0.3, state.playerW * 0.3),
      y: state.playerY + state.playerH * 0.5,
      vx: random(-18, 18),
      vy: random(180, 310),
      life: random(0.12, 0.24),
      color: state.boosting ? "#ffb02e" : "#20c7b4",
      size: random(1.5, 3),
    });
  }
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 260 * dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = clamp(particle.life * 2.2, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function updateHud() {
  if (!state) return;
  speedValue.textContent = Math.round(state.speed);
  scoreValue.textContent = Math.floor(state.score).toLocaleString("en-US");
  distanceValue.textContent = (state.distance / 1000).toFixed(1);
  comboValue.textContent = `x${state.combo.toFixed(1)}`;
  heatFill.style.width = `${state.heat}%`;
  runCoinsValue.textContent = `${state.runCoins} coins`;
  shieldValue.textContent = state.shield ? "Shield ready" : state.grace > 0 ? "Grace" : "Shield off";
  shieldValue.classList.toggle("active", state.shield || state.grace > 0);
  muteBtn.textContent = save.muted ? "Sound Off" : "Sound On";
  pauseBtn.disabled = !["running", "countdown", "paused"].includes(state.status);

  if (state.status === "countdown") {
    objectiveBar.textContent = "Get ready";
  } else if (state.mode === MODES.time) {
    const remaining = Math.max(0, Math.ceil(state.mode.timeLimit - state.elapsed));
    objectiveBar.textContent = `${remaining}s - target ${state.mode.target.toLocaleString("en-US")}`;
  } else if (state.mode === MODES.challenge) {
    objectiveBar.textContent = `${state.nearMisses}/${state.mode.target} near misses`;
  } else {
    objectiveBar.textContent = `${state.mode.label} - ${state.overtakes} overtakes`;
  }
}

function updateGarageUi() {
  const key = carSelect.value;
  const car = getCarStats(key);
  const upgrades = save.upgrades[key];
  const statCards = `
    <div><span>Speed</span><strong>${Math.round(car.topSpeed)}</strong></div>
    <div><span>Accel</span><strong>${Math.round(car.acceleration)}</strong></div>
    <div><span>Grip</span><strong>${car.handling.toFixed(1)}</strong></div>
    <div><span>Boost</span><strong>${Math.round(car.boost)}</strong></div>
  `;
  const upgradeCards = Object.entries(UPGRADE_CONFIG).map(([upgradeKey, config]) => {
    const level = upgrades[upgradeKey];
    const maxed = level >= MAX_UPGRADE_LEVEL;
    const cost = getUpgradeCost(level, config.baseCost);
    const disabled = maxed || save.coins < cost;
    const action = maxed ? "Max" : `${cost} coins`;
    return `
      <div class="upgrade-card">
        <span>${config.label}</span>
        <strong>Lv ${level}/${MAX_UPGRADE_LEVEL}</strong>
        <button type="button" data-upgrade="${upgradeKey}" ${disabled ? "disabled" : ""}>${action}</button>
      </div>
    `;
  }).join("");

  carStats.innerHTML = statCards + upgradeCards;
  bankCoinsValue.textContent = `${save.coins} bank coins`;
  bestScoreValue.textContent = `Best ${save.bestScore.toLocaleString("en-US")}`;
  muteBtn.textContent = save.muted ? "Sound Off" : "Sound On";
}

function buyUpgrade(upgradeKey) {
  const carKey = carSelect.value;
  const config = UPGRADE_CONFIG[upgradeKey];
  if (!config) return;

  const level = save.upgrades[carKey][upgradeKey];
  if (level >= MAX_UPGRADE_LEVEL) return;

  const cost = getUpgradeCost(level, config.baseCost);
  if (save.coins < cost) return;

  save.coins -= cost;
  save.upgrades[carKey][upgradeKey] += 1;
  saveData();
  updateGarageUi();
  state = createState();
  resizeCanvas();
  draw();
  updateHud();
  playTone(560, 0.08, "triangle", 0.03);
}

function getUpgradeCost(level, baseCost) {
  return Math.round(baseCost * Math.pow(1.62, level));
}

function getCarStats(key) {
  const base = BASE_CARS[key];
  const upgrades = save.upgrades[key];
  return {
    key,
    name: base.name,
    color: base.color,
    topSpeed: base.topSpeed + upgrades.topSpeed * UPGRADE_CONFIG.topSpeed.step,
    acceleration: base.acceleration + upgrades.acceleration * UPGRADE_CONFIG.acceleration.step,
    handling: base.handling + upgrades.handling * UPGRADE_CONFIG.handling.step,
    braking: base.braking + upgrades.braking * UPGRADE_CONFIG.braking.step,
    boost: base.boost + upgrades.boost * UPGRADE_CONFIG.boost.step,
  };
}

function moveLane(direction) {
  if (!state || state.status !== "running") return;
  state.targetLane = clamp(state.targetLane + direction, 0, LANES - 1);
}

function pauseRun() {
  if (!["running", "countdown"].includes(state.status)) return;
  state.pausedFrom = state.status;
  state.status = "paused";
  pauseOverlay.classList.remove("hidden");
  pauseBtn.textContent = "Resume";
}

function resumeRun() {
  if (state.status !== "paused") return;
  state.status = state.pausedFrom || "running";
  pauseOverlay.classList.add("hidden");
  pauseBtn.textContent = "Pause";
  lastTime = performance.now();
}

function togglePause() {
  if (state.status === "paused") resumeRun();
  else pauseRun();
}

function playerBox() {
  return {
    x: state.playerX - state.playerW * 0.38,
    y: state.playerY - state.playerH * 0.42,
    w: state.playerW * 0.76,
    h: state.playerH * 0.78,
  };
}

function carBox(car) {
  return {
    x: car.x - car.w * 0.38,
    y: car.y - car.h * 0.42,
    w: car.w * 0.76,
    h: car.h * 0.78,
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function overlapsCircleBox(circle, box) {
  const closestX = clamp(circle.x, box.x, box.x + box.w);
  const closestY = clamp(circle.y, box.y, box.y + box.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.width = rect.width;
  view.height = rect.height;
  view.roadWidth = Math.min(rect.width * (1 - ROAD_MARGIN * 2), 520);
  view.roadLeft = (rect.width - view.roadWidth) / 2;
  view.laneWidth = view.roadWidth / LANES;
  if (state) {
    updatePlayerDimensions();
    state.playerX = laneCenter(state.targetLane);
    state.playerY = view.height * 0.76;
  }
}

function updatePlayerDimensions() {
  const width = clamp(view.laneWidth * 0.46, 34, 54);
  state.playerW = width;
  state.playerH = width * 1.82;
}

function laneCenter(lane) {
  return view.roadLeft + view.laneWidth * (lane + 0.5);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function approach(value, target, amount) {
  if (value < target) return Math.min(target, value + amount);
  return Math.max(target, value - amount);
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function lighten(hex, amount) {
  return shade(hex, amount);
}

function darken(hex, amount) {
  return shade(hex, -amount);
}

function shade(hex, amount) {
  const raw = hex.replace("#", "");
  const num = parseInt(raw, 16);
  const r = clamp((num >> 16) + Math.round(255 * amount), 0, 255);
  const g = clamp(((num >> 8) & 255) + Math.round(255 * amount), 0, 255);
  const b = clamp((num & 255) + Math.round(255 * amount), 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function initAudio() {
  if (save.muted || audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (error) {
    audioCtx = null;
  }
}

function playTone(frequency, duration, type = "sine", gain = 0.025) {
  if (save.muted) return;
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  amp.gain.value = gain;
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start();
  amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

function defaultUpgrades() {
  return {
    topSpeed: 0,
    acceleration: 0,
    handling: 0,
    braking: 0,
    boost: 0,
  };
}

function createDefaultSave() {
  const upgrades = {};
  Object.keys(BASE_CARS).forEach((key) => {
    upgrades[key] = defaultUpgrades();
  });
  return {
    coins: 120,
    bestScore: 0,
    bestDistance: 0,
    runs: 0,
    muted: false,
    upgrades,
  };
}

function loadSave() {
  const fallback = createDefaultSave();
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!parsed || typeof parsed !== "object") return fallback;
    const merged = { ...fallback, ...parsed, upgrades: { ...fallback.upgrades, ...parsed.upgrades } };
    Object.keys(BASE_CARS).forEach((key) => {
      merged.upgrades[key] = { ...defaultUpgrades(), ...merged.upgrades[key] };
    });
    return merged;
  } catch (error) {
    return fallback;
  }
}

function saveData() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    // Progress is optional; the game remains playable if storage is blocked.
  }
}

function bindHold(button, key, activeClass = true) {
  const on = (event) => {
    event.preventDefault();
    input[key] = true;
    if (activeClass) button.classList.add("active");
  };
  const off = (event) => {
    event.preventDefault();
    input[key] = false;
    button.classList.remove("active");
  };
  button.addEventListener("pointerdown", on);
  button.addEventListener("pointerup", off);
  button.addEventListener("pointercancel", off);
  button.addEventListener("pointerleave", off);
}

leftBtn.addEventListener("click", () => moveLane(-1));
rightBtn.addEventListener("click", () => moveLane(1));
bindHold(brakeBtn, "brake");
bindHold(boostBtn, "boost");

startBtn.addEventListener("click", startRun);
restartBtn.addEventListener("click", startRun);
resumeBtn.addEventListener("click", resumeRun);
endRunBtn.addEventListener("click", () => finishRun("Run Ended"));
pauseBtn.addEventListener("click", togglePause);
muteBtn.addEventListener("click", () => {
  save.muted = !save.muted;
  saveData();
  updateGarageUi();
  updateHud();
});

garageBtn.addEventListener("click", () => {
  resultOverlay.classList.add("hidden");
  startOverlay.classList.remove("hidden");
  state = createState();
  resizeCanvas();
  draw();
  updateHud();
});

carStats.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade]");
  if (!button) return;
  buyUpgrade(button.dataset.upgrade);
});

carSelect.addEventListener("change", () => {
  updateGarageUi();
  state = createState();
  resizeCanvas();
  draw();
  updateHud();
});

modeSelect.addEventListener("change", () => {
  state = createState();
  resizeCanvas();
  draw();
  updateHud();
});

canvas.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) {
    moveLane(dx > 0 ? 1 : -1);
  }
  pointerStart = null;
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") moveLane(-1);
  if (key === "arrowright" || key === "d") moveLane(1);
  if (key === "arrowdown" || key === "s") input.brake = true;
  if (key === " " || key === "arrowup" || key === "w") input.boost = true;
  if (key === "p" || key === "escape") togglePause();
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowdown" || key === "s") input.brake = false;
  if (key === " " || key === "arrowup" || key === "w") input.boost = false;
});

window.addEventListener("resize", () => {
  resizeCanvas();
  draw();
});

state = createState();
updateGarageUi();
resizeCanvas();
draw();
updateHud();
