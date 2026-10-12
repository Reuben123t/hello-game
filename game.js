/**
 * Chrono Dino Arcade Runner
 * HTML5 Canvas + Web Audio API Game Engine
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {
      // Audio fallback fail safe
    }
  }

  playScoreMilestone() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const playTone = (freq, start, dur) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      };
      playTone(587.33, now, 0.08); // D5
      playTone(880, now + 0.09, 0.16); // A5
    } catch (e) {}
  }

  playGameOver() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }

  playDuck() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }
}

class DinoGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundEffects();

    // Virtual canvas resolution
    this.width = 900;
    this.height = 350;
    this.groundY = 280;

    // High DPI setup
    this.setupDPI();
    window.addEventListener('resize', () => this.setupDPI());

    // Game state
    this.state = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER' | 'PAUSED'
    this.score = 0;
    this.hiScore = parseInt(localStorage.getItem('chrono_dino_hiscore') || '0', 10);
    this.baseSpeed = 7.5;
    this.speed = this.baseSpeed;
    this.distanceTraveled = 0;
    this.lastMilestone = 0;
    this.lastFrameTime = performance.now();

    // Day/Night Cycle (0 to 1)
    this.dayCycle = 0;

    // Stars
    this.stars = [];
    for (let i = 0; i < 45; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * (this.groundY - 80),
        size: Math.random() * 2 + 0.5,
        twinkleSpeed: Math.random() * 0.04 + 0.01,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Clouds
    this.clouds = [
      { x: 120, y: 50, speedRatio: 0.2, scale: 0.9 },
      { x: 450, y: 85, speedRatio: 0.15, scale: 1.2 },
      { x: 750, y: 35, speedRatio: 0.25, scale: 0.8 }
    ];

    // Ground details
    this.groundBumps = [];
    for (let x = 0; x < this.width + 100; x += 18) {
      if (Math.random() < 0.45) {
        this.groundBumps.push({
          x: x,
          width: Math.random() * 8 + 3,
          height: Math.random() * 3 + 1
        });
      }
    }

    // Dino character
    this.dino = {
      x: 70,
      y: this.groundY,
      width: 44,
      height: 48,
      duckHeight: 28,
      velocityY: 0,
      gravity: 0.95,
      jumpForce: -14.5,
      isGrounded: true,
      isDucking: false,
      runAnimTimer: 0,
      legFrame: 0,
      blinkTimer: 0,
      isBlinking: false
    };

    // Obstacles & Particles
    this.obstacles = [];
    this.particles = [];
    this.obstacleSpawnTimer = 0;
    this.minSpawnInterval = 75; // frames

    // Controls
    this.keys = {
      jump: false,
      duck: false
    };

    // DOM UI elements
    this.scoreValEl = document.getElementById('scoreVal');
    this.hiScoreValEl = document.getElementById('hiScoreVal');
    this.speedValEl = document.getElementById('speedVal');
    this.startOverlay = document.getElementById('startOverlay');
    this.gameOverOverlay = document.getElementById('gameOverOverlay');
    this.finalScoreVal = document.getElementById('finalScoreVal');
    this.newBestBadge = document.getElementById('newBestBadge');
    this.startBtn = document.getElementById('startBtn');
    this.restartBtn = document.getElementById('restartBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.soundText = document.getElementById('soundText');

    this.updateHUD();
    this.bindEvents();

    // Start loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  setupDPI() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.sound.init();

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (this.state === 'START' || this.state === 'GAMEOVER') {
          this.startGame();
        } else if (this.state === 'PLAYING') {
          this.triggerJump();
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        if (this.state === 'PLAYING') {
          this.setDuck(true);
        }
      } else if (e.code === 'KeyP') {
        this.togglePause();
      } else if (e.code === 'KeyM') {
        this.toggleSound();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.setDuck(false);
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        // Variable jump height: cut jump short if released early
        if (this.dino.velocityY < -6) {
          this.dino.velocityY = -6;
        }
      }
    });

    // Button clicks
    this.startBtn.addEventListener('click', () => {
      this.sound.init();
      this.startGame();
    });

    this.restartBtn.addEventListener('click', () => {
      this.sound.init();
      this.startGame();
    });

    // Canvas click to jump
    this.canvas.addEventListener('pointerdown', (e) => {
      this.sound.init();
      if (this.state === 'START' || this.state === 'GAMEOVER') {
        this.startGame();
      } else if (this.state === 'PLAYING') {
        this.triggerJump();
      }
    });

    // Touch controls
    const jumpTouch = document.getElementById('jumpTouchBtn');
    const duckTouch = document.getElementById('duckTouchBtn');

    if (jumpTouch) {
      jumpTouch.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'START' || this.state === 'GAMEOVER') {
          this.startGame();
        } else {
          this.triggerJump();
        }
      });
    }

    if (duckTouch) {
      duckTouch.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.sound.init();
        this.setDuck(true);
      });
      duckTouch.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.setDuck(false);
      });
    }

    this.soundToggleBtn.addEventListener('click', () => {
      this.toggleSound();
    });
  }

  toggleSound() {
    this.sound.init();
    this.sound.enabled = !this.sound.enabled;
    this.soundIcon.textContent = this.sound.enabled ? '🔊' : '🔇';
    this.soundText.textContent = this.sound.enabled ? 'Sound ON' : 'Sound OFF';
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.lastFrameTime = performance.now();
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.speed = this.baseSpeed;
    this.lastMilestone = 0;
    this.obstacles = [];
    this.particles = [];
    this.obstacleSpawnTimer = 40;

    this.dino.y = this.groundY;
    this.dino.velocityY = 0;
    this.dino.isGrounded = true;
    this.dino.isDucking = false;

    this.startOverlay.classList.remove('active');
    this.startOverlay.classList.add('hidden');
    this.gameOverOverlay.classList.remove('active');
    this.gameOverOverlay.classList.add('hidden');
    this.newBestBadge.classList.add('hidden');

    this.lastFrameTime = performance.now();
  }

  triggerJump() {
    if (this.dino.isGrounded) {
      this.dino.velocityY = this.dino.jumpForce;
      this.dino.isGrounded = false;
      this.sound.playJump();

      // Emit jump particles
      for (let i = 0; i < 7; i++) {
        this.particles.push({
          x: this.dino.x + 15 + (Math.random() * 15),
          y: this.groundY,
          vx: (Math.random() - 0.5) * 4 - 2,
          vy: -Math.random() * 3 - 1,
          size: Math.random() * 4 + 2,
          color: 'rgba(0, 243, 255, 0.7)',
          alpha: 1,
          decay: 0.04
        });
      }
    }
  }

  setDuck(ducking) {
    if (ducking && !this.dino.isDucking && this.dino.isGrounded) {
      this.sound.playDuck();
    }
    this.dino.isDucking = ducking;
    if (!this.dino.isGrounded && ducking) {
      // Fast drop when ducking mid-air
      this.dino.velocityY += 7;
    }
  }

  spawnObstacle() {
    // Determine type: Cacti or Pterodactyl (after score > 280)
    const canSpawnBird = this.score > 280 && Math.random() < 0.35;

    if (canSpawnBird) {
      // Pterodactyl: Flying low (jump over) or medium (duck under)
      const birdAltitude = Math.random() < 0.55 ? 42 : 72; // height from ground
      this.obstacles.push({
        type: 'bird',
        x: this.width + 50,
        y: this.groundY - birdAltitude,
        width: 42,
        height: 28,
        wingFrame: 0,
        wingTimer: 0,
        flapSpeed: 10
      });
    } else {
      // Cactus variants: small, tall, cluster of 2 or 3
      const variant = Math.floor(Math.random() * 4);
      let w = 20;
      let h = 42;

      if (variant === 0) {
        // Single small cactus
        w = 18;
        h = 36;
      } else if (variant === 1) {
        // Single tall cactus
        w = 22;
        h = 50;
      } else if (variant === 2) {
        // Double cactus
        w = 36;
        h = 42;
      } else {
        // Triple cactus
        w = 48;
        h = 42;
      }

      this.obstacles.push({
        type: 'cactus',
        variant: variant,
        x: this.width + 30,
        y: this.groundY - h,
        width: w,
        height: h
      });
    }
  }

  handleGameOver() {
    this.state = 'GAMEOVER';
    this.sound.playGameOver();

    const isNewBest = this.score > this.hiScore;
    if (isNewBest) {
      this.hiScore = Math.floor(this.score);
      localStorage.setItem('chrono_dino_hiscore', this.hiScore.toString());
      this.newBestBadge.classList.remove('hidden');
    }

    this.finalScoreVal.textContent = Math.floor(this.score);
    this.gameOverOverlay.classList.remove('hidden');
    this.gameOverOverlay.classList.add('active');

    // Create explosion effect on collision point
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x: this.dino.x + 20,
        y: this.dino.y - 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 2,
        color: Math.random() < 0.5 ? '#ff2a85' : '#00f3ff',
        alpha: 1,
        decay: 0.02 + Math.random() * 0.02
      });
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    // Progression: speed increases gradually
    this.score += dt * 10;
    this.speed = this.baseSpeed + Math.min(7, Math.floor(this.score / 150) * 0.45);

    // Day/night progression (cycles every 700 points)
    this.dayCycle = (Math.sin((this.score / 350) * Math.PI) + 1) / 2;

    // Milestone sound every 100 points
    const currentHundred = Math.floor(this.score / 100);
    if (currentHundred > this.lastMilestone) {
      this.lastMilestone = currentHundred;
      this.sound.playScoreMilestone();
    }

    // Dino Physics
    if (!this.dino.isGrounded) {
      this.dino.velocityY += this.dino.gravity;
      this.dino.y += this.dino.velocityY;

      if (this.dino.y >= this.groundY) {
        this.dino.y = this.groundY;
        this.dino.velocityY = 0;
        this.dino.isGrounded = true;
      }
    }

    // Dino Animations
    this.dino.runAnimTimer++;
    if (this.dino.runAnimTimer > Math.max(3, 7 - Math.floor(this.speed / 2.5))) {
      this.dino.runAnimTimer = 0;
      this.dino.legFrame = (this.dino.legFrame + 1) % 2;
    }

    // Blinking
    this.dino.blinkTimer++;
    if (this.dino.blinkTimer > 200) {
      this.dino.isBlinking = true;
      if (this.dino.blinkTimer > 212) {
        this.dino.isBlinking = false;
        this.dino.blinkTimer = 0;
      }
    }

    // Ground dust particles when running
    if (this.dino.isGrounded && Math.random() < 0.35) {
      this.particles.push({
        x: this.dino.x + 8,
        y: this.groundY - 2,
        vx: -this.speed * 0.35 - Math.random() * 1.5,
        vy: -Math.random() * 1.5,
        size: Math.random() * 3 + 1,
        color: 'rgba(255, 255, 255, 0.4)',
        alpha: 0.8,
        decay: 0.05
      });
    }

    // Clouds movement
    this.clouds.forEach(cloud => {
      cloud.x -= this.speed * cloud.speedRatio;
      if (cloud.x < -100) {
        cloud.x = this.width + 60 + Math.random() * 100;
        cloud.y = 30 + Math.random() * 80;
      }
    });

    // Ground bump details movement
    this.groundBumps.forEach(bump => {
      bump.x -= this.speed;
      if (bump.x < -20) {
        bump.x = this.width + Math.random() * 30;
      }
    });

    // Spawn obstacles
    this.obstacleSpawnTimer--;
    if (this.obstacleSpawnTimer <= 0) {
      this.spawnObstacle();
      // Distance interval scales with speed to remain fair and dodgeable
      const minGap = 55 + Math.floor(this.speed * 2.2);
      const randGap = Math.floor(Math.random() * 45);
      this.obstacleSpawnTimer = minGap + randGap;
    }

    // Update Obstacles & Collision Check
    const dinoHitbox = this.getDinoHitbox();

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.speed;

      if (obs.type === 'bird') {
        obs.wingTimer++;
        if (obs.wingTimer > obs.flapSpeed) {
          obs.wingTimer = 0;
          obs.wingFrame = (obs.wingFrame + 1) % 2;
        }
      }

      // Check collision with bounding box
      const obsHitbox = {
        x: obs.x + 4,
        y: obs.y + 4,
        width: obs.width - 8,
        height: obs.height - 8
      };

      if (this.checkCollision(dinoHitbox, obsHitbox)) {
        this.handleGameOver();
        break;
      }

      // Remove off-screen obstacles
      if (obs.x + obs.width < -50) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    this.updateHUD();
  }

  getDinoHitbox() {
    const isDuck = this.dino.isDucking && this.dino.isGrounded;
    const currentHeight = isDuck ? this.dino.duckHeight : this.dino.height;
    return {
      x: this.dino.x + 6,
      y: this.dino.y - currentHeight + 4,
      width: (isDuck ? 54 : this.dino.width) - 12,
      height: currentHeight - 6
    };
  }

  checkCollision(rect1, rect2) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  updateHUD() {
    const pad = (num, len = 5) => String(Math.floor(num)).padStart(len, '0');
    this.scoreValEl.textContent = pad(this.score);
    this.hiScoreValEl.textContent = pad(Math.max(this.score, this.hiScore));
    this.speedValEl.textContent = (this.speed / this.baseSpeed).toFixed(1) + 'x';
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Dynamic Sky gradient (Day -> Dusk -> Neon Night)
    this.drawSky();

    // 2. Stars (fade in during night)
    this.drawStars();

    // 3. Celestial body (Sun / Neon Moon)
    this.drawCelestial();

    // 4. Parallax Clouds
    this.drawClouds();

    // 5. Desert Ground & Pebbles
    this.drawGround();

    // 6. Obstacles (Cacti & Birds)
    this.drawObstacles();

    // 7. Particles
    this.drawParticles();

    // 8. Dino Character
    this.drawDino();
  }

  drawSky() {
    // Interpolate sky colors based on dayCycle
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.groundY);
    if (this.dayCycle > 0.5) {
      // Day / Dusk
      const t = (this.dayCycle - 0.5) * 2;
      gradient.addColorStop(0, `rgb(${26 + t * 20}, ${32 + t * 40}, ${64 + t * 60})`);
      gradient.addColorStop(1, `rgb(${14 + t * 10}, ${17 + t * 15}, ${32 + t * 20})`);
    } else {
      // Night / Deep Neon Midnight
      gradient.addColorStop(0, '#0c0e1a');
      gradient.addColorStop(1, '#16192b');
    }
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawStars() {
    const nightIntensity = 1 - this.dayCycle;
    if (nightIntensity < 0.1) return;

    this.ctx.save();
    for (const star of this.stars) {
      star.phase += star.twinkleSpeed;
      const alpha = (0.3 + 0.7 * Math.abs(Math.sin(star.phase))) * nightIntensity;
      this.ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawCelestial() {
    // Sun or Moon traversing the sky
    const x = 760;
    const y = 65;
    this.ctx.save();

    if (this.dayCycle > 0.4) {
      // Sun with warm golden glow
      const sunGrad = this.ctx.createRadialGradient(x, y, 0, x, y, 32);
      sunGrad.addColorStop(0, 'rgba(255, 200, 80, 0.95)');
      sunGrad.addColorStop(0.6, 'rgba(255, 140, 40, 0.4)');
      sunGrad.addColorStop(1, 'rgba(255, 100, 20, 0)');
      this.ctx.fillStyle = sunGrad;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 32, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ffe699';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 14, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Neon Crescent Moon
      this.ctx.shadowColor = '#00f3ff';
      this.ctx.shadowBlur = 16;
      this.ctx.fillStyle = '#d2f6ff';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 16, 0, Math.PI * 2);
      this.ctx.fill();

      // Shadow cutout for crescent
      this.ctx.fillStyle = '#0f1222';
      this.ctx.beginPath();
      this.ctx.arc(x - 6, y - 4, 14, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.clouds.forEach(cloud => {
      this.ctx.save();
      this.ctx.translate(cloud.x, cloud.y);
      this.ctx.scale(cloud.scale, cloud.scale);

      this.ctx.beginPath();
      this.ctx.arc(15, 15, 15, 0, Math.PI * 2);
      this.ctx.arc(35, 10, 18, 0, Math.PI * 2);
      this.ctx.arc(55, 15, 14, 0, Math.PI * 2);
      this.ctx.rect(15, 15, 40, 15);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  drawGround() {
    this.ctx.save();
    // Horizon neon line
    this.ctx.strokeStyle = '#2d3758';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.groundY);
    this.ctx.lineTo(this.width, this.groundY);
    this.ctx.stroke();

    // Subtle neon glow under line
    this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.groundY + 1);
    this.ctx.lineTo(this.width, this.groundY + 1);
    this.ctx.stroke();

    // Ground bumps / pebbles
    this.ctx.fillStyle = '#414e77';
    this.groundBumps.forEach(b => {
      this.ctx.fillRect(b.x, this.groundY + 4, b.width, b.height);
    });

    this.ctx.restore();
  }

  drawObstacles() {
    this.obstacles.forEach(obs => {
      if (obs.type === 'cactus') {
        this.drawCactus(obs);
      } else if (obs.type === 'bird') {
        this.drawBird(obs);
      }
    });
  }

  drawCactus(obs) {
    this.ctx.save();
    this.ctx.fillStyle = '#00e5a3'; // Neon green cactus
    this.ctx.shadowColor = 'rgba(0, 229, 163, 0.5)';
    this.ctx.shadowBlur = 8;

    const { x, y, width, height, variant } = obs;

    if (variant === 0 || variant === 1) {
      // Single cactus with arms
      const stemW = 8;
      const stemX = x + (width - stemW) / 2;
      // Main stem
      this.ctx.fillRect(stemX, y, stemW, height);
      // Left arm
      this.ctx.fillRect(stemX - 7, y + height * 0.35, 8, 4);
      this.ctx.fillRect(stemX - 7, y + height * 0.2, 4, height * 0.2);
      // Right arm
      this.ctx.fillRect(stemX + stemW, y + height * 0.45, 7, 4);
      this.ctx.fillRect(stemX + stemW + 3, y + height * 0.3, 4, height * 0.2);
    } else {
      // Cluster of 2 or 3 cacti
      const count = variant === 2 ? 2 : 3;
      const subW = width / count;
      for (let i = 0; i < count; i++) {
        const cx = x + i * subW + 2;
        const ch = height - (i % 2 === 0 ? 0 : 8);
        const cy = this.groundY - ch;
        this.ctx.fillRect(cx, cy, 7, ch);
        if (i % 2 === 0) {
          this.ctx.fillRect(cx + 6, cy + 12, 5, 3);
          this.ctx.fillRect(cx + 8, cy + 6, 3, 8);
        } else {
          this.ctx.fillRect(cx - 5, cy + 10, 5, 3);
          this.ctx.fillRect(cx - 5, cy + 5, 3, 7);
        }
      }
    }
    this.ctx.restore();
  }

  drawBird(bird) {
    this.ctx.save();
    this.ctx.fillStyle = '#ff7733'; // Neon orange pterodactyl
    this.ctx.shadowColor = 'rgba(255, 119, 51, 0.6)';
    this.ctx.shadowBlur = 10;

    const { x, y, wingFrame } = bird;

    // Body & Head
    this.ctx.fillRect(x + 10, y + 8, 18, 8);
    // Beak
    this.ctx.beginPath();
    this.ctx.moveTo(x + 10, y + 8);
    this.ctx.lineTo(x, y + 12);
    this.ctx.lineTo(x + 10, y + 14);
    this.ctx.fill();
    // Eye
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x + 12, y + 9, 3, 3);
    this.ctx.fillStyle = '#ff7733';

    // Tail
    this.ctx.fillRect(x + 28, y + 10, 10, 4);

    // Flapping Wings
    if (wingFrame === 0) {
      // Wing Up
      this.ctx.beginPath();
      this.ctx.moveTo(x + 16, y + 8);
      this.ctx.lineTo(x + 10, y - 8);
      this.ctx.lineTo(x + 24, y + 8);
      this.ctx.fill();
    } else {
      // Wing Down
      this.ctx.beginPath();
      this.ctx.moveTo(x + 16, y + 16);
      this.ctx.lineTo(x + 12, y + 26);
      this.ctx.lineTo(x + 24, y + 16);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawDino() {
    this.ctx.save();
    const d = this.dino;
    const isDuck = d.isDucking && d.isGrounded;

    this.ctx.fillStyle = '#00f3ff'; // Vibrant neon cyan Dino
    this.ctx.shadowColor = 'rgba(0, 243, 255, 0.7)';
    this.ctx.shadowBlur = 12;

    if (isDuck) {
      // Ducking Dino Sprite
      const y = d.y - d.duckHeight;
      // Elongated body
      this.ctx.fillRect(d.x, y + 8, 48, 16);
      // Low head & snout
      this.ctx.fillRect(d.x + 36, y, 18, 14);
      // Tail
      this.ctx.fillRect(d.x - 8, y + 10, 10, 8);

      // Eye
      if (!d.isBlinking) {
        this.ctx.fillStyle = '#0c0e18';
        this.ctx.fillRect(d.x + 44, y + 3, 4, 4);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(d.x + 46, y + 4, 2, 2);
      }

      // Ducking running feet
      this.ctx.fillStyle = '#00f3ff';
      if (d.legFrame === 0) {
        this.ctx.fillRect(d.x + 12, y + 24, 6, 4);
        this.ctx.fillRect(d.x + 32, y + 22, 6, 2);
      } else {
        this.ctx.fillRect(d.x + 12, y + 22, 6, 2);
        this.ctx.fillRect(d.x + 32, y + 24, 6, 4);
      }
    } else {
      // Standing / Jumping Dino Sprite
      const y = d.y - d.height;

      // Head & Snout
      this.ctx.fillRect(d.x + 18, y, 24, 18);
      this.ctx.fillRect(d.x + 30, y + 10, 14, 8); // muzzle

      // Neck & Torso
      this.ctx.fillRect(d.x + 14, y + 14, 18, 22);

      // Cute Little Arm
      this.ctx.fillRect(d.x + 30, y + 22, 7, 3);
      this.ctx.fillRect(d.x + 34, y + 24, 3, 4);

      // Back & Tail
      this.ctx.fillRect(d.x + 4, y + 20, 12, 14);
      this.ctx.fillRect(d.x - 4, y + 22, 8, 8);
      this.ctx.fillRect(d.x - 8, y + 24, 5, 4);

      // Eye
      if (!d.isBlinking) {
        this.ctx.fillStyle = '#0c0e18';
        this.ctx.fillRect(d.x + 24, y + 4, 5, 5);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(d.x + 26, y + 5, 2, 2);
      }

      // Legs animation
      this.ctx.fillStyle = '#00f3ff';
      if (!d.isGrounded) {
        // Jumping legs tucked
        this.ctx.fillRect(d.x + 14, y + 36, 6, 6);
        this.ctx.fillRect(d.x + 22, y + 34, 6, 6);
      } else {
        // Running legs
        if (d.legFrame === 0) {
          this.ctx.fillRect(d.x + 14, y + 36, 5, 12);
          this.ctx.fillRect(d.x + 14, y + 46, 8, 2); // foot
          this.ctx.fillRect(d.x + 23, y + 36, 5, 6);
        } else {
          this.ctx.fillRect(d.x + 14, y + 36, 5, 6);
          this.ctx.fillRect(d.x + 23, y + 36, 5, 12);
          this.ctx.fillRect(d.x + 23, y + 46, 8, 2); // foot
        }
      }
    }

    this.ctx.restore();
  }

  drawParticles() {
    this.ctx.save();
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  gameLoop(currentTime) {
    const dt = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  window.dinoGame = new DinoGame();
});
