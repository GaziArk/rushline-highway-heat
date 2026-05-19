const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const speedValue = document.querySelector("#speedValue");
const scoreValue = document.querySelector("#scoreValue");
const distanceValue = document.querySelector("#distanceValue");
const comboValue = document.querySelector("#comboValue");
const heatFill = document.querySelector("#heatFill");
const objectiveBar = document.querySelector("#objectiveBar");
const startOverlay = document.querySelector("#startOverlay");
const resultOverlay = document.querySelector("#resultOverlay");
const startBtn = document.querySelector("#startBtn");
const restartBtn = document.querySelector("#restartBtn");
const garageBtn = document.querySelector("#garageBtn");
const leftBtn = document.querySelector("#leftBtn");
const rightBtn = document.querySelector("#rightBtn");
const brakeBtn = document.querySelector("#brakeBtn");
const boostBtn = document.querySelector("#boostBtn");
const modeSelect = document.querySelector("#modeSelect");
const carSelect = document.querySelector("#carSelect");
const carStats = document.querySelector("#carStats");
const resultKicker = document.querySelector("#resultKicker");
const resultTitle = document.querySelector("#resultTitle");
const finalScore = document.querySelector("#finalScore");
const finalDistance = document.querySelector("#finalDistance");
const finalNearMisses = document.querySelector("#finalNearMisses");
const finalCoins = document.querySelector("#finalCoins");

const LANES = 4;
const ROAD_MARGIN = 0.11;

const CARS = {
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

let state;
let rafId = 0;
let lastTime = 0;
let view = { width: 0, height: 0, roadLeft: 0, roadWidth: 0, laneWidth: 0 };
let pointerStart = null;
const input = { brake: false, boost: false };

function createState() {
  const mode = MODES[modeSelect.value];
  const car = CARS[carSelect.value];
  return {
    status: "menu",
    mode,
    car,
    speed: 0,
    score: 0,
    distance: 0,
    coins: 0,
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
    traffic: [],
    particles: [],
    spawnTimer: 0,
    nextSpawn: 0.65,
    elapsed: 0,
    nearMisses: 0,
    overtakes: 0,
    objectiveComplete: false,
    shake: 0,
    messageFlash: "",
    messageTimer: 0,
  };
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

function startRun() {
  state = createState();
  state.status = "running";
  state.targetLane = Math.floor(LANES / 2) - 1;
  state.lane = state.targetLane;
  updatePlayerDimensions();
  state.playerX = laneCenter(state.targetLane);
  state.playerY = view.height * 0.76;
  startOverlay.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  lastTime = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (state.status === "running") {
    update(dt);
  } else if (state.status === "finished") {
    updateParticles(dt);
  }

  draw();
  updateHud();
  rafId = requestAnimationFrame(loop);
}

function update(dt) {
  state.elapsed += dt;
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.shake = Math.max(0, state.shake - dt * 18);

  const boostActive = input.boost && state.boostEnergy > 1 && state.speed > 72;
  const targetSpeed = input.brake ? 58 : state.car.topSpeed + (boostActive ? state.car.boost : 0);
  const rate = input.brake ? state.car.braking : state.car.acceleration;
  state.speed = approach(state.speed, targetSpeed, rate * dt);

  if (boostActive) {
    state.boostEnergy = Math.max(0, state.boostEnergy - 31 * dt);
    addSpeedParticles(3);
  } else {
    const regen = input.brake ? 10 : 6;
    state.boostEnergy = Math.min(100, state.boostEnergy + regen * dt);
  }

  const targetX = laneCenter(state.targetLane);
  const steerRate = Math.min(1, state.car.handling * dt);
  state.playerX += (targetX - state.playerX) * steerRate;
  state.lane = Math.round((state.playerX - view.roadLeft) / view.laneWidth - 0.5);

  const meters = (state.speed * 1000 / 3600) * dt;
  state.distance += meters;
  state.roadOffset = (state.roadOffset + state.speed * 2.4 * dt) % 80;
  state.heat = Math.max(0, state.heat - (boostActive ? 2.5 : 7.5) * dt);
  state.combo = 1 + Math.floor(state.heat / 20) * 0.25;
  state.score += meters * 10 * state.combo;

  spawnTraffic(dt);
  updateTraffic(dt);
  updateParticles(dt);
  checkObjectives();
}

function spawnTraffic(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;

  const speedFactor = clamp(state.speed / 170, 0.4, 1.55);
  state.nextSpawn = clamp((0.95 - speedFactor * 0.18) / state.mode.density, 0.34, 0.95);
  state.spawnTimer = state.nextSpawn;

  const blockedLanes = new Set(
    state.traffic
      .filter((car) => car.y < view.height * 0.22)
      .map((car) => car.targetLane)
  );

  const openLanes = Array.from({ length: LANES }, (_, lane) => lane).filter((lane) => !blockedLanes.has(lane));
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
    y: -height - Math.random() * 180,
    w: width,
    h: height,
    speed: random(template.speed[0], template.speed[1]),
    passed: false,
    nearMissed: false,
    laneShiftTimer: random(2, 5),
  };

  state.traffic.push(trafficCar);
}

function updateTraffic(dt) {
  for (const car of state.traffic) {
    car.laneShiftTimer -= dt;
    maybeShiftTrafficLane(car);
    car.x += (laneCenter(car.targetLane) - car.x) * Math.min(1, 3.2 * dt);
    car.y += Math.max(90, (state.speed - car.speed) * 2.65 + 96) * dt;

    if (overlaps(playerBox(), carBox(car))) {
      crash();
      return;
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

function maybeShiftTrafficLane(car) {
  if (car.laneShiftTimer > 0 || car.y < 60 || Math.random() > 0.018) return;
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
}

function rewardOvertake() {
  state.overtakes += 1;
  state.heat = Math.min(100, state.heat + 5);
  state.score += 90 * state.combo;
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
  finishRun("Crashed");
}

function finishRun(title) {
  if (state.status !== "running") return;
  state.status = "finished";
  state.speed = 0;
  const bonus = state.objectiveComplete ? 120 : 0;
  state.coins = Math.floor(state.score / 850) + state.nearMisses * 2 + Math.floor(state.distance / 220) + bonus;
  resultKicker.textContent = state.objectiveComplete ? "Objective complete" : "Run complete";
  resultTitle.textContent = title;
  finalScore.textContent = Math.floor(state.score).toLocaleString("en-US");
  finalDistance.textContent = (state.distance / 1000).toFixed(2);
  finalNearMisses.textContent = state.nearMisses;
  finalCoins.textContent = state.coins;
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
    drawTraffic();
    drawPlayer();
    drawParticles();
    drawBoostGauge();
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

function drawTraffic() {
  for (const car of state.traffic) {
    drawCar(car.x, car.y, car.w, car.h, car.color, false, car.type);
  }
}

function drawPlayer() {
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
    ctx.fillStyle = "rgba(32, 199, 180, 0.38)";
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
      color: "#20c7b4",
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

  if (state.mode === MODES.time) {
    const remaining = Math.max(0, Math.ceil(state.mode.timeLimit - state.elapsed));
    objectiveBar.textContent = `${remaining}s - target ${state.mode.target.toLocaleString("en-US")}`;
  } else if (state.mode === MODES.challenge) {
    objectiveBar.textContent = `${state.nearMisses}/${state.mode.target} near misses`;
  } else {
    objectiveBar.textContent = `${state.mode.label} - ${state.overtakes} overtakes`;
  }
}

function updateCarStats() {
  const car = CARS[carSelect.value];
  carStats.innerHTML = `
    <div><span>Speed</span><strong>${car.topSpeed}</strong></div>
    <div><span>Accel</span><strong>${car.acceleration}</strong></div>
    <div><span>Grip</span><strong>${car.handling.toFixed(1)}</strong></div>
    <div><span>Boost</span><strong>${car.boost}</strong></div>
  `;
}

function moveLane(direction) {
  if (!state || state.status !== "running") return;
  state.targetLane = clamp(state.targetLane + direction, 0, LANES - 1);
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
garageBtn.addEventListener("click", () => {
  resultOverlay.classList.add("hidden");
  startOverlay.classList.remove("hidden");
  state = createState();
  draw();
  updateHud();
});

carSelect.addEventListener("change", updateCarStats);
modeSelect.addEventListener("change", () => {
  state = createState();
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
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") moveLane(-1);
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") moveLane(1);
  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") input.brake = true;
  if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") input.boost = true;
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") input.brake = false;
  if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") input.boost = false;
});

window.addEventListener("resize", () => {
  resizeCanvas();
  draw();
});

state = createState();
updateCarStats();
resizeCanvas();
draw();
updateHud();
