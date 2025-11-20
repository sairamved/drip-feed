const DROP_INTERVAL = 1000;
const SMALL_CIRCLE_RADIUS = 5;
const LARGE_CIRCLE_RADIUS = 10;
const FALL_ACCELERATION = 0.4;
const SIDE_FORCE = 0.05;
const REPULSION_FORCE = 1.2;
const REPULSION_RADIUS = 40;
const DAMPING = 0.88;
const SETTLE_Y = 0.6;
const MAX_FALL_SPEED = 12;
const FRICTION = 0.87;
const LEFT_X = 0.40;
const RIGHT_X = 0.60;

let drops = [];
let largeCircles = [];
let aloneRatios = [];
let lastDropTime = 0;
let dropCount = 0;
let timeScale = 1;

function preload() {
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
}

function draw() {
  background(0);
  noFill();
  stroke('#fffff1');
  strokeWeight(1.5);
  
  let currentHour = hour();
  let aloneRatio = aloneRatios[currentHour] || 0.5;
  
  if (millis() * timeScale - lastDropTime > DROP_INTERVAL) {
    let isAlone = random() < aloneRatio;
    drops.push(new Drop(isAlone));
    lastDropTime = millis() * timeScale;
    dropCount++;
  }
  
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
    this.y = 0;
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
    circle(this.x, this.y, LARGE_CIRCLE_RADIUS * 2);
  }
}
