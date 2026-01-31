// sketch.js - p5 driven by Pi notifications

// ===== CONFIGURATION =====
// Set to true to use Raspberry Pi WebSocket, false to use system clock
const USE_RASPBERRY_PI = true;
// =========================

const SMALL_CIRCLE_RADIUS = 8;
const LARGE_CIRCLE_RADIUS = 14;
const FALL_ACCELERATION = 0.7;
const SIDE_FORCE = 0.05;
const REPULSION_FORCE = 1.2;
const REPULSION_RADIUS = 40;
const DAMPING = 0.88;
const SETTLE_Y = 0.6;
const MAX_FALL_SPEED = 12;
const FRICTION = 0.87;
const LEFT_X = 0.20;
const RIGHT_X = 0.80;

let drops = [];
let largeCircles = [];
let aloneRatios = [];
let dropCount = 0;

let socket;
let serverFont;
let lastDripTime = 0;
const DRIP_INTERVAL = 1000;

function preload() {
  serverFont = loadFont('ServerMono-Regular.otf');
  
  loadTable('alone_ratio_by_hour.csv', 'csv', 'header', 
    (table) => {
      console.log('Table loaded, rows:', table.getRowCount());
      for (let i = 0; i < table.getRowCount(); i++) {
        let row = table.getRow(i);
        aloneRatios.push(row.getNum('alone_ratio'));
      }
      console.log('Loaded ratios:', aloneRatios);
    },
    (error) => {
      console.error('Error loading CSV:', error);
    }
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(serverFont);

  if (USE_RASPBERRY_PI) {
    // ===== RASPBERRY PI MODE =====
    // WebSocket to Pi (same origin if served by Pi)
    const loc = window.location;
    const wsProtocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = wsProtocol + '//' + loc.host;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected to', wsUrl);
    };

    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'DRIP_END') {
          createDrop();
        } else if (msg.type === 'TICK') {
          // console.log('Tick from Pi:', new Date(msg.time).toLocaleTimeString());
        }
      } catch (err) {
        console.error('Failed parse ws message', err, ev.data);
      }
    };

    socket.onclose = () => console.log('WebSocket closed');
    socket.onerror = (e) => console.error('WebSocket error', e);
  } else {
    // ===== SYSTEM CLOCK MODE =====
    lastDripTime = millis();
  }
}

function draw() {
  background(0);

  // System clock mode: create drip every second
  if (!USE_RASPBERRY_PI) {
    if (millis() - lastDripTime >= DRIP_INTERVAL) {
      createDrop();
      lastDripTime = millis();
    }
  }
  // Pi mode: drips created via WebSocket in setup()

  if (largeCircles.length >= 60) {
    reset();
  }

  for (let i = drops.length - 1; i >= 0; i--) {
    drops[i].update();
    drops[i].display();
  }

  for (let i = largeCircles.length - 1; i >= 0; i--) {
    largeCircles[i].update();
    largeCircles[i].display();
  }

  if (frameCount % 10 === 0) {
    checkConsolidation();
  }

  drawLabels();
  drawLegend();
}

function createDrop() {
  let currentHour = hour();
  let aloneRatio = aloneRatios[currentHour] || 0.5;
  let isAlone = random() < aloneRatio;
  drops.push(new Drop(isAlone));
  dropCount++;
}

function checkConsolidation() {
  let leftSmall = drops.filter(d => d.settled && d.isAlone);
  let rightSmall = drops.filter(d => d.settled && !d.isAlone);

  if (leftSmall.length >= 60) {
    let avgX = leftSmall.reduce((sum, d) => sum + d.x, 0) / 60;
    let avgY = leftSmall.reduce((sum, d) => sum + d.y, 0) / 60;
    largeCircles.push(new LargeCircle(avgX, avgY, true));
    for (let i = 0; i < 60; i++) {
      let idx = drops.indexOf(leftSmall[i]);
      if (idx > -1) drops.splice(idx, 1);
    }
  }

  if (rightSmall.length >= 60) {
    let avgX = rightSmall.reduce((sum, d) => sum + d.x, 0) / 60;
    let avgY = rightSmall.reduce((sum, d) => sum + d.y, 0) / 60;
    largeCircles.push(new LargeCircle(avgX, avgY, false));
    for (let i = 0; i < 60; i++) {
      let idx = drops.indexOf(rightSmall[i]);
      if (idx > -1) drops.splice(idx, 1);
    }
  }
}

function reset() {
  drops = [];
  largeCircles = [];
  dropCount = 0;
}


class Drop {
  constructor(isAlone) {
    this.x = width / 2;
    this.y = height / 2;
    this.vx = 0;
    this.vy = 0;
    this.isAlone = isAlone;
    this.settled = false;
    this.falling = true;
    this.targetX = isAlone ? width * LEFT_X : width * RIGHT_X;
    this.targetY = height * SETTLE_Y;
  }

  update() {
    if (!this.settled) {
      if (this.falling && this.y < this.targetY) {
        let progress = this.y / this.targetY;
        let easedAccel = FALL_ACCELERATION * (1 + progress * progress);
        this.vy += easedAccel;

        if (this.vy > MAX_FALL_SPEED) {
          this.vy = MAX_FALL_SPEED;
        }
      } else {
        if (this.falling) {
          this.falling = false;
          this.vy *= 0.3;
        }

        let dx = this.targetX - this.x;
        let dy = this.targetY - this.y;
        this.vx += dx * SIDE_FORCE;
        this.vy += dy * SIDE_FORCE * 0.5;
      }

      if (!this.falling) {
        this.applyRepulsion(drops);
        this.applyRepulsion(largeCircles);
      }

      if (!this.falling) {
        this.vx *= FRICTION;
        this.vy *= FRICTION;
      } else {
        this.vx *= DAMPING;
      }

      this.x += this.vx;
      this.y += this.vy;

      this.x = constrain(this.x, SMALL_CIRCLE_RADIUS, width - SMALL_CIRCLE_RADIUS);
      this.y = constrain(this.y, SMALL_CIRCLE_RADIUS, height - SMALL_CIRCLE_RADIUS);

      if (!this.falling && abs(this.vx) < 0.3 && abs(this.vy) < 0.3) {
        this.settled = true;
        this.vx = 0;
        this.vy = 0;
      }
    }
  }

  applyRepulsion(others) {
    for (let i = 0; i < others.length; i++) {
      let other = others[i];
      if (other === this || (other instanceof Drop && !other.settled && other.falling)) continue;

      let dx = this.x - other.x;
      let dy = this.y - other.y;
      let distSq = dx * dx + dy * dy;

      if (distSq > REPULSION_RADIUS * REPULSION_RADIUS) continue;

      let d = sqrt(distSq);
      let minDist = SMALL_CIRCLE_RADIUS * 2;
      if (other instanceof LargeCircle) {
        minDist = SMALL_CIRCLE_RADIUS + LARGE_CIRCLE_RADIUS;
      }

      if (d < minDist && d > 0) {
        let overlap = minDist - d;
        let force = overlap * 0.5;
        this.vx += (dx / d) * force;
        this.vy += (dy / d) * force;
      } else if (d > 0) {
        let force = (REPULSION_RADIUS - d) / REPULSION_RADIUS * REPULSION_FORCE;
        this.vx += (dx / d) * force;
        this.vy += (dy / d) * force;
      }
    }
  }

  display() {
    if (this.isAlone) {
      noFill();
      stroke('#fffff1');
      strokeWeight(1.5);
    } else {
      fill('#fffff1');
      noStroke();
    }
    circle(this.x, this.y, SMALL_CIRCLE_RADIUS * 2);
  }
}

class LargeCircle {
  constructor(x, y, isAlone) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isAlone = isAlone;
  }

  update() {
    this.applyRepulsion(largeCircles);
    this.applyRepulsion(drops);

    this.vx *= DAMPING;
    this.vy *= DAMPING;

    this.x += this.vx;
    this.y += this.vy;

    this.x = constrain(this.x, LARGE_CIRCLE_RADIUS, width - LARGE_CIRCLE_RADIUS);
    this.y = constrain(this.y, LARGE_CIRCLE_RADIUS, height - LARGE_CIRCLE_RADIUS);
  }

  applyRepulsion(others) {
    for (let other of others) {
      if (other === this) continue;
      let dx = this.x - other.x;
      let dy = this.y - other.y;
      let d = sqrt(dx * dx + dy * dy);
      let minDist = LARGE_CIRCLE_RADIUS * 2;
      if (other instanceof Drop) {
        minDist = LARGE_CIRCLE_RADIUS + SMALL_CIRCLE_RADIUS;
      }

      if (d < minDist) {
        let overlap = minDist - d;
        let force = overlap * 0.5;
        if (d > 0) {
          this.vx += (dx / d) * force;
          this.vy += (dy / d) * force;
        }
      } else if (d < REPULSION_RADIUS && d > 0) {
        let force = (REPULSION_RADIUS - d) / REPULSION_RADIUS * REPULSION_FORCE;
        this.vx += (dx / d) * force;
        this.vy += (dy / d) * force;
      }
    }
  }

  display() {
    if (this.isAlone) {
      noFill();
      stroke('#fffff1');
      strokeWeight(1.5);
    } else {
      fill('#fffff1');
      noStroke();
    }
    circle(this.x, this.y, LARGE_CIRCLE_RADIUS * 2);
  }
}

function drawLabels() {
  fill('#fffff1');
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(16);
  
  text('alone', width * LEFT_X, height * 0.1);
  text('with others', width * RIGHT_X, height * 0.1);
}

function drawLegend() {
  fill('#fffff1');
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(14);
  
  let legendX = 20;
  let legendY = height - 60;
  
  noFill();
  stroke('#fffff1');
  strokeWeight(1.5);
  circle(legendX + 10, legendY, SMALL_CIRCLE_RADIUS * 2);
  
  fill('#fffff1');
  noStroke();
  text(' 01 person', legendX + 25, legendY);
  
  noFill();
  stroke('#fffff1');
  strokeWeight(1.5);
  circle(legendX + 10, legendY + 30, LARGE_CIRCLE_RADIUS * 2);
  
  fill('#fffff1');
  noStroke();
  text(' 60 people', legendX + 25, legendY + 30);
}
