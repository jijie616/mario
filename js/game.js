/* ============================================================
   SUPER MARIO · HTML5 — game engine
   A complete 8-bit platformer built on HTML5 Canvas.
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const TILE = 16;
  const VIEW_W = 256;
  const VIEW_H = 240;
  const GROUND_TOP = 13 * TILE;
  const PLAYER_W = 12;
  const PLAYER_H_SMALL = 16;
  const PLAYER_H_BIG = 32;

  const MAX_WALK = 1.55;
  const MAX_RUN = 2.55;
  const GRAVITY = 0.34;
  const JUMP_GRAVITY_HOLD = 0.16;
  const JUMP_GRAVITY_RELEASE = 0.46;
  const MAX_FALL = 6.5;
  const JUMP_VELOCITY = 5.05;
  const COYOTE_FRAMES = 6;
  const JUMP_BUFFER_FRAMES = 8;
  const BUMP_FRAMES = 10;

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const approach = (v, target, amount) => {
    if (v < target) return Math.min(v + amount, target);
    if (v > target) return Math.max(v - amount, target);
    return target;
  };
  const pad = (number, length) => String(Math.max(0, Math.floor(number))).padStart(length, "0").slice(-length);
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function loadNumber(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      if (value == null) return fallback;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function saveNumber(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (err) {
      /* file:// localStorage can be restricted; the game still works. */
    }
  }

  /* ============================================================
     Level data → tile grid
     ============================================================ */

  class GameLevel {
    constructor(data) {
      this.data = data;
      this.theme = data.theme;
      this.decor = data.decor || { clouds: [], hills: [], bushes: [] };
      this.width = data.width;
      this.height = 15;
      this.tiles = Array.from({ length: this.height }, () => Array(this.width).fill(null));
      this.bumps = [];
      this.end = null;
      this.build();
    }

    set(tx, ty, type, extra) {
      if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return;
      this.tiles[ty][tx] = Object.assign({ type, bump: 0 }, extra || {});
    }

    build() {
      const data = this.data;

      for (const segment of data.ground) {
        const start = Math.max(0, segment[0]);
        const end = Math.min(this.width - 1, segment[1]);
        for (let tx = start; tx <= end; tx++) {
          this.set(tx, 13, "ground");
          this.set(tx, 14, "ground");
        }
      }

      if (data.ceiling) {
        for (let row = 0; row < data.ceiling; row++) {
          for (let tx = 0; tx < this.width; tx++) {
            this.set(tx, row, "hard");
          }
        }
      }

      for (const block of data.blocks) {
        if (block.type === "question") {
          this.set(block.x, block.y, "question", { item: block.item || "coin" });
        } else {
          this.set(block.x, block.y, block.type);
        }
      }

      for (const pipe of data.pipes) {
        this.addPipe(pipe.x, pipe.top, pipe.height);
      }

      if (data.end.type === "pipe") {
        this.addPipe(data.end.x, data.end.top, data.end.height);
        this.end = {
          type: "pipe",
          pipeX: data.end.x * TILE,
          pipeTop: data.end.top * TILE,
          pipeBottom: (data.end.top + data.end.height) * TILE,
          hint: Boolean(data.end.hint),
          completed: false,
        };
      } else {
        this.end = {
          type: "flag",
          poleX: data.end.x * TILE + 8,
          groundY: GROUND_TOP,
          castleX: data.end.castleX * TILE,
          flagY: GROUND_TOP - 144 + 14,
          castleFlag: 0,
          completed: false,
        };
      }
    }

    addPipe(x, top, height) {
      for (let i = 0; i < height; i++) {
        const ty = top + i;
        const part = i === 0;
        this.set(x, ty, "pipe", { part: part ? "pipeTopLeft" : "pipeBodyLeft" });
        this.set(x + 1, ty, "pipe", { part: part ? "pipeTopRight" : "pipeBodyRight" });
      }
    }

    solidAt(tx, ty) {
      if (tx < 0 || tx >= this.width) return true;
      if (ty < 0 || ty >= this.height) return false;
      return this.tiles[ty][tx] !== null;
    }

    tileAt(tx, ty) {
      if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return null;
      return this.tiles[ty][tx];
    }

    removeTile(tx, ty) {
      if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return;
      const tile = this.tiles[ty][tx];
      this.tiles[ty][tx] = null;
      const index = this.bumps.indexOf(tile);
      if (index >= 0) this.bumps.splice(index, 1);
    }

    addBump(tx, ty) {
      const tile = this.tileAt(tx, ty);
      if (!tile) return;
      tile.bump = BUMP_FRAMES;
      if (this.bumps.indexOf(tile) === -1) this.bumps.push(tile);
    }

    updateBumps() {
      for (let i = this.bumps.length - 1; i >= 0; i--) {
        const tile = this.bumps[i];
        tile.bump--;
        if (tile.bump <= 0) {
          tile.bump = 0;
          this.bumps.splice(i, 1);
        }
      }
    }

    getEndPipe() {
      return this.end && this.end.type === "pipe" ? this.end : null;
    }
  }

  /* ============================================================
     Player
     ============================================================ */

  class Player {
    constructor(game, startX, surfaceY, power) {
      this.game = game;
      this.w = PLAYER_W;
      this.power = power || 0;
      this.h = this.power > 0 ? PLAYER_H_BIG : PLAYER_H_SMALL;
      this.x = startX * TILE - this.w / 2;
      this.y = surfaceY - this.h;
      this.spawnX = startX * TILE;
      this.spawnY = surfaceY;
      this.vx = 0;
      this.vy = 0;
      this.prevY = this.y;
      this.facing = 1;
      this.onGround = false;
      this.prevOnGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.skidding = false;
      this.walkTimer = 0;
      this.animFrame = 0;
      this.invuln = 0;
      this.starTimer = 0;
      this.fireCooldown = 0;
      this.dead = false;
      this.visible = true;
      this.controlLocked = false;
      this.justJumped = false;
      this.wasOnGroundAtLanding = false;
    }

    get feet() {
      return this.y + this.h;
    }

    setPower(power) {
      this.power = power;
    }

    update(input) {
      this.prevY = this.y;
      this.prevOnGround = this.onGround;
      this.justJumped = false;

      this.jumpHeld = input.jumpHeld;
      if (this.invuln > 0) this.invuln--;
      if (this.fireCooldown > 0) this.fireCooldown--;
      if (this.starTimer > 0) {
        this.starTimer--;
        if (this.starTimer === 0) this.game.onStarEnded();
      }

      const level = this.game.level;
      const dir = this.controlLocked ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const running = input.run && !this.controlLocked;
      const maxSpeed = running ? MAX_RUN : MAX_WALK;

      if (dir !== 0) {
        this.facing = dir;
        const turning = Math.abs(this.vx) > 0.12 && Math.sign(this.vx) !== dir;
        let accel;
        if (this.onGround) accel = turning ? 0.28 : 0.115;
        else accel = turning ? 0.11 : 0.075;
        if (running) accel += this.onGround ? 0.025 : 0.012;
        this.vx += dir * accel;
        this.skidding = this.onGround && turning && Math.abs(this.vx) > 0.22;
        if (this.skidding && this.game.frames % 5 === 0) {
          this.game.spawnDust(this.x + (dir > 0 ? 1 : this.w - 1), this.feet - 2, -dir);
        }
      } else {
        this.skidding = false;
        const friction = this.onGround ? 0.105 : 0.012;
        this.vx = approach(this.vx, 0, friction);
      }

      const cap = running ? MAX_RUN : MAX_WALK;
      if (Math.abs(this.vx) > cap) {
        const decel = this.onGround ? (dir === 0 ? 0.16 : 0.055) : 0.014;
        this.vx = approach(this.vx, Math.sign(this.vx) * cap, decel);
      }
      this.vx = clamp(this.vx, -MAX_RUN - 0.12, MAX_RUN + 0.12);
      if (Math.abs(this.vx) < 0.035 && dir === 0) this.vx = 0;

      this.jumpBuffer = input.jumpBuffer;
      if (input.jumpBuffer > 0 && (this.onGround || this.coyote > 0) && !this.controlLocked) {
        const boost = Math.min(0.32, Math.abs(this.vx) * 0.11);
        this.vy = -(JUMP_VELOCITY + boost);
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.game.jumpBuffer = 0;
        this.justJumped = true;
        this.game.onPlayerJump();
        const grav = input.jumpHeld ? JUMP_GRAVITY_HOLD : JUMP_GRAVITY_RELEASE;
        this.vy += grav;
      } else {
        let gravity;
        if (this.vy < 0) gravity = input.jumpHeld ? JUMP_GRAVITY_HOLD : JUMP_GRAVITY_RELEASE;
        else gravity = GRAVITY;
        this.vy = Math.min(this.vy + gravity, MAX_FALL);
      }

      // Horizontal movement and collision
      const minX = Math.max(0, this.game.cameraX);
      const maxX = level.width * TILE - this.w;
      this.x += this.vx;
      if (this.x < minX) {
        this.x = minX;
        if (this.vx < 0) this.vx = 0;
      } else if (this.x > maxX) {
        this.x = maxX;
        if (this.vx > 0) this.vx = 0;
      }
      this.collideX(level);

      // Vertical movement and collision
      this.onGround = false;
      const fallImpact = this.vy;
      this.y += this.vy;
      this.collideY(level);

      if (this.onGround) {
        if (!this.prevOnGround && !this.justJumped) {
          this.game.onPlayerLand(Math.abs(fallImpact));
        }
        this.coyote = COYOTE_FRAMES;
        if (!this.justJumped) this.game.stompCombo = 0;
        this.walkTimer += Math.abs(this.vx);
      } else {
        this.coyote = Math.max(0, this.coyote - 1);
        if (this.walkTimer !== 0) this.walkTimer += Math.abs(this.vx) * 0.3;
      }
      this.animFrame = Math.floor(this.walkTimer / 7) % 2;

      if (this.y > VIEW_H + 60) {
        this.game.killPlayer("pit");
      }
    }

    collideX(level) {
      if (this.vx > 0) {
        const edge = this.x + this.w - 0.001;
        const tx = Math.floor(edge / TILE);
        const top = Math.floor((this.y + 2) / TILE);
        const bottom = Math.floor((this.y + this.h - 2) / TILE);
        for (let ty = top; ty <= bottom; ty++) {
          if (level.solidAt(tx, ty)) {
            this.x = tx * TILE - this.w;
            this.vx = 0;
            break;
          }
        }
      } else if (this.vx < 0) {
        const tx = Math.floor(this.x / TILE);
        const top = Math.floor((this.y + 2) / TILE);
        const bottom = Math.floor((this.y + this.h - 2) / TILE);
        for (let ty = top; ty <= bottom; ty++) {
          if (level.solidAt(tx, ty)) {
            this.x = (tx + 1) * TILE;
            this.vx = 0;
            break;
          }
        }
      }
    }

    collideY(level) {
      if (this.vy < 0) {
        const ty = Math.floor(this.y / TILE);
        const left = Math.floor((this.x + 1) / TILE);
        const right = Math.floor((this.x + this.w - 1) / TILE);
        const hitTiles = [];
        for (let tx = left; tx <= right; tx++) {
          if (level.solidAt(tx, ty)) {
            hitTiles.push([tx, ty]);
          }
        }
        if (hitTiles.length > 0) {
          this.y = (ty + 1) * TILE;
          this.vy = 0;
          const seen = new Set();
          for (const [hx, hy] of hitTiles) {
            const key = hx + "," + hy;
            if (seen.has(key)) continue;
            seen.add(key);
            this.game.onHeadButt(hx, hy);
          }
        }
      } else if (this.vy >= 0) {
        const bottom = this.y + this.h;
        const ty = Math.floor((bottom - 0.001) / TILE);
        const left = Math.floor((this.x + 1) / TILE);
        const right = Math.floor((this.x + this.w - 1) / TILE);
        for (let tx = left; tx <= right; tx++) {
          if (level.solidAt(tx, ty)) {
            this.y = ty * TILE - this.h;
            this.vy = 0;
            this.onGround = true;
            break;
          }
        }
      }
    }

    fire() {
      if (this.power !== 2 || this.fireCooldown > 0 || this.controlLocked) return false;
      if (this.game.fireballs.filter((ball) => !ball.remove).length >= 2) return false;
      this.fireCooldown = 14;
      this.game.spawnFireball(this);
      return true;
    }

    hurt() {
      if (this.invuln > 0 || this.starTimer > 0) return false;
      if (this.power > 0) {
        const feet = this.feet;
        this.power--;
        this.h = this.power > 0 ? PLAYER_H_BIG : PLAYER_H_SMALL;
        this.y = feet - this.h;
        this.invuln = 120;
        this.vx = -this.facing * 1.1;
        this.vy = -1.8;
        this.game.onPlayerDamaged();
        return true;
      }
      this.game.killPlayer("hit");
      return true;
    }
  }

  /* ============================================================
     Enemies
     ============================================================ */

  class Enemy {
    constructor(game, def) {
      this.game = game;
      this.type = def.type;
      this.w = 14;
      this.h = def.type === "koopa" ? 24 : 16;
      this.x = def.x * TILE + 1;
      this.y = def.y * TILE - this.h;
      this.spawnX = this.x;
      this.spawnY = this.y;
      this.vx = def.type === "koopa" ? -0.38 : -0.52;
      this.vy = 0;
      this.facing = -1;
      this.state = "walk";
      this.active = false;
      this.dead = false;
      this.flipped = false;
      this.flippedTimer = 0;
      this.squashedTimer = 0;
      this.grace = 0;
      this.shellCooldown = 0;
      this.onGround = false;
      this.animTimer = 0;
      this.frame = 0;
      this.kind = def.type;
    }

    activate() {
      this.active = true;
    }

    update(level) {
      if (this.squashedTimer > 0) {
        this.squashedTimer--;
        if (this.squashedTimer === 0) this.dead = true;
        return;
      }

      if (this.flipped) {
        this.flippedTimer--;
        this.vy = Math.min(this.vy + 0.24, MAX_FALL);
        this.x += this.vx;
        this.y += this.vy;
        if (this.flippedTimer <= 0 || this.y > VIEW_H + 80) this.dead = true;
        return;
      }

      if (this.shellCooldown > 0) this.shellCooldown--;
      if (this.grace > 0) this.grace--;
      if (!this.active) return;

      this.animTimer += Math.abs(this.vx) + 0.2;
      this.frame = Math.floor(this.animTimer / 8) % 2;

      if (this.type === "koopa" && this.state === "shell") {
        // Stationary shells still obey gravity and can be nudged off ledges.
      }

      this.vy = Math.min(this.vy + 0.3, MAX_FALL);
      this.moveX(level);
      this.moveY(level);

      if (this.y > VIEW_H + 80) this.dead = true;
    }

    moveX(level) {
      if (!this.vx) return;
      this.x += this.vx;
      const tx = Math.floor((this.vx > 0 ? this.x + this.w - 0.001 : this.x) / TILE);
      const top = Math.floor((this.y + 2) / TILE);
      const bottom = Math.floor((this.y + this.h - 2) / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        if (level.solidAt(tx, ty)) {
          if (this.vx > 0) this.x = tx * TILE - this.w;
          else this.x = (tx + 1) * TILE;
          this.vx *= -1;
          this.facing = Math.sign(this.vx) || this.facing;
          break;
        }
      }
    }

    moveY(level) {
      this.onGround = false;
      this.y += this.vy;
      if (this.vy >= 0) {
        const ty = Math.floor((this.y + this.h - 0.001) / TILE);
        const left = Math.floor((this.x + 1) / TILE);
        const right = Math.floor((this.x + this.w - 1) / TILE);
        for (let tx = left; tx <= right; tx++) {
          if (level.solidAt(tx, ty)) {
            this.y = ty * TILE - this.h;
            this.vy = 0;
            this.onGround = true;
            break;
          }
        }
      } else {
        const ty = Math.floor(this.y / TILE);
        const left = Math.floor((this.x + 1) / TILE);
        const right = Math.floor((this.x + this.w - 1) / TILE);
        for (let tx = left; tx <= right; tx++) {
          if (level.solidAt(tx, ty)) {
            this.y = (ty + 1) * TILE;
            this.vy = 0;
            break;
          }
        }
      }
    }

    stomp() {
      if (this.dead || this.flipped) return;
      if (this.type === "goomba") {
        this.state = "squashed";
        this.squashedTimer = 32;
        this.vx = 0;
        this.game.sound("stomp");
        return;
      }

      if (this.state === "walk") {
        const feet = this.y + this.h;
        this.state = "shell";
        this.h = 14;
        this.y = feet - this.h;
        this.vx = 0;
        this.shellCooldown = 18;
        this.grace = 8;
        this.game.sound("stomp");
      } else if (this.state === "shellMove") {
        this.state = "shell";
        this.vx = 0;
        this.shellCooldown = 18;
        this.grace = 8;
        this.game.sound("stomp");
      } else {
        this.game.sound("stomp");
      }
    }

    kick(direction) {
      if (this.type !== "koopa" || this.state !== "shell" || this.dead) return;
      this.state = "shellMove";
      this.vx = direction * 2.5;
      this.facing = direction;
      this.shellCooldown = 16;
      this.grace = 16;
      this.game.sound("kick");
    }

    kill(direction, flip) {
      if (this.dead || this.flipped || this.squashedTimer > 0) return;
      this.flipped = true;
      this.flippedTimer = 120;
      this.vy = -3.6;
      this.vx = direction * 0.8;
      if (flip === false) {
        this.dead = true;
        return;
      }
    }

    getDrawBox() {
      return { x: this.x + 1, y: this.y + 2, w: this.w - 2, h: this.h - 2 };
    }
  }

  /* ============================================================
     Items and projectiles
     ============================================================ */

  class Item {
    constructor(game, type, blockX, blockTop) {
      this.game = game;
      this.type = type;
      this.w = 14;
      this.h = 14;
      this.x = blockX * TILE + 1;
      this.y = blockTop;
      this.startY = blockTop;
      this.targetY = blockTop - 16;
      this.emerging = true;
      this.emergeSpeed = 0.8;
      this.vx = 0;
      this.vy = 0;
      this.remove = false;
      this.facing = 1;
      this.bobPhase = Math.random() * Math.PI * 2;
    }

    update(level) {
      if (this.remove) return;

      if (this.emerging) {
        this.y -= this.emergeSpeed;
        if (this.y <= this.targetY) {
          this.y = this.targetY;
          this.emerging = false;
          if (this.type === "mushroom" || this.type === "1up") this.vx = 0.85;
          if (this.type === "star") this.vx = 1.25;
        }
        return;
      }

      if (this.type === "flower") return;

      this.vy = Math.min(this.vy + 0.28, MAX_FALL);
      this.x += this.vx;
      const tx = Math.floor((this.vx > 0 ? this.x + this.w - 0.001 : this.x) / TILE);
      const top = Math.floor((this.y + 2) / TILE);
      const bottom = Math.floor((this.y + this.h - 2) / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        if (level.solidAt(tx, ty)) {
          if (this.vx > 0) this.x = tx * TILE - this.w;
          else this.x = (tx + 1) * TILE;
          this.vx *= -1;
          break;
        }
      }

      this.y += this.vy;
      if (this.vy >= 0) {
        const ty = Math.floor((this.y + this.h - 0.001) / TILE);
        const left = Math.floor((this.x + 1) / TILE);
        const right = Math.floor((this.x + this.w - 1) / TILE);
        for (let bx = left; bx <= right; bx++) {
          if (level.solidAt(bx, ty)) {
            this.y = ty * TILE - this.h;
            if (this.type === "star") this.vy = -3.4;
            else this.vy = 0;
            break;
          }
        }
      } else {
        const ty = Math.floor(this.y / TILE);
        if (level.solidAt(Math.floor((this.x + this.w / 2) / TILE), ty)) {
          this.y = (ty + 1) * TILE;
          this.vy = 0;
        }
      }

      if (this.y > VIEW_H + 60) this.remove = true;
    }
  }

  class Fireball {
    constructor(game, x, y, vx, vy) {
      this.game = game;
      this.w = 8;
      this.h = 8;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.remove = false;
      this.life = 190;
      this.anim = 0;
    }

    update(level) {
      if (this.remove) return;
      this.life--;
      this.anim++;
      if (this.life <= 0) {
        this.remove = true;
        return;
      }

      this.vy = Math.min(this.vy + 0.23, 4.2);

      this.x += this.vx;
      const tx = Math.floor((this.vx > 0 ? this.x + this.w : this.x) / TILE);
      const ty = Math.floor((this.y + this.h / 2) / TILE);
      if (level.solidAt(tx, ty)) {
        this.remove = true;
        this.game.spawnFireSpark(this.x, this.y);
        return;
      }

      this.y += this.vy;
      if (this.vy > 0) {
        const by = Math.floor((this.y + this.h) / TILE);
        const bx = Math.floor((this.x + this.w / 2) / TILE);
        if (level.solidAt(bx, by)) {
          this.y = by * TILE - this.h;
          this.vy = -2.6;
        }
      } else if (this.vy < 0) {
        const by = Math.floor(this.y / TILE);
        const bx = Math.floor((this.x + this.w / 2) / TILE);
        if (level.solidAt(bx, by)) {
          this.y = (by + 1) * TILE;
          this.vy = 0;
        }
      }

      if (this.x < this.game.cameraX - 20 || this.x > this.game.cameraX + VIEW_W + 40 || this.y > VIEW_H + 20) {
        this.remove = true;
      }
    }
  }

  /* ============================================================
     Game controller
     ============================================================ */

  class Game {
    constructor() {
      this.state = "title";
      this.stateTimer = 0;
      this.frames = 0;
      this.clock = 0;
      this.levelIndex = 0;
      this.level = null;
      this.player = null;
      this.cameraX = 0;
      this.score = 0;
      this.coins = 0;
      this.lives = 3;
      this.timeLeft = 400;
      this.timeTicker = 0;
      this.hurryPlayed = false;
      this.jumpBuffer = 0;
      this.stompCombo = 0;
      this.highScore = loadNumber("mario-highscore", 0);
      this.coinEntities = [];
      this.enemies = [];
      this.items = [];
      this.fireballs = [];
      this.particles = [];
      this.coinPops = [];
      this.popups = [];
      this.flagPhase = null;
      this.fontBlink = 0;
      this.lastFrame = 0;
      this.accumulator = 0;
      this.starMusicPlaying = false;
      this.levelIntroTimer = 0;
      this.clearBonus = 0;
      this.titleSeed = 0;
      this.winScene = null;
      this.didSaveHigh = false;
      this.debugMode = /(?:\?|&)debug=1/.test(window.location.search);
      this.pauseReason = "";
      this.soundOn = !window.Sound.muted;
      this.lastTime = 0;
      this.startedAt = performance.now();
      this.bindEvents();
      this.syncUI();
      this.syncSoundUI();
    }

    /* ---------------- input ---------------- */

    bindEvents() {
      window.addEventListener("keydown", (event) => this.onKeyDown(event));
      window.addEventListener("keyup", (event) => this.onKeyUp(event));
      window.addEventListener("blur", () => this.onBlur());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.state === "playing") {
          this.pauseGame(true);
        }
      });

      canvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        window.Sound.init();
        if (this.state === "title" || this.state === "gameover" || this.state === "win") {
          this.startNewGame();
        } else if (this.state === "paused") {
          this.resumeGame();
        } else {
          canvas.focus();
        }
      });

      const pauseButton = document.getElementById("pauseButton");
      const soundButton = document.getElementById("soundButton");
      const fullscreenButton = document.getElementById("fullscreenButton");

      pauseButton.addEventListener("click", () => {
        window.Sound.init();
        this.togglePause();
      });

      soundButton.addEventListener("click", () => {
        window.Sound.init();
        window.Sound.toggleMute();
        this.syncSoundUI();
      });

      fullscreenButton.addEventListener("click", () => {
        this.toggleFullscreen();
      });
      document.addEventListener("fullscreenchange", () => this.syncFullscreenUI());

      document.querySelectorAll(".touch-button").forEach((button) => {
        const control = button.dataset.control;
        const release = (event) => {
          if (event) event.preventDefault();
          this.setTouchControl(control, false);
          button.classList.remove("is-pressed");
        };
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          window.Sound.init();
          button.setPointerCapture?.(event.pointerId);
          button.classList.add("is-pressed");
          if (this.state === "title" || this.state === "gameover" || this.state === "win") {
            this.startNewGame();
            return;
          }
          if (this.state === "clear" && this.stateTimer > 25) {
            this.advanceAfterClear();
            return;
          }
          this.setTouchControl(control, true);
          if (this.state === "playing") {
            if (control === "jump") this.queueJump();
            if (control === "run") this.tryFire();
          }
        });
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", release);
      });

      canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    onKeyDown(event) {
      const code = event.code;
      const mapped = [
        "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space",
        "KeyA", "KeyD", "KeyW", "KeyZ", "KeyX", "KeyJ", "KeyK",
        "ShiftLeft", "ShiftRight", "Enter", "KeyP", "Escape", "KeyM", "KeyF",
      ].includes(code);
      if (mapped) event.preventDefault();
      if (event.repeat) {
        if (code === "KeyX" || code === "KeyJ") {
          this.tryFire();
        }
        return;
      }

      window.Sound.init();
      this.keyDownSet.add(code);

      if (code === "ArrowLeft" || code === "KeyA") this.syncKeyboardControl();
      else if (code === "ArrowRight" || code === "KeyD") this.syncKeyboardControl();
      else if (code === "Space" || code === "KeyZ" || code === "KeyK" || code === "ArrowUp" || code === "KeyW") {
        this.onJumpKeyDown();
      } else if (code === "ShiftLeft" || code === "ShiftRight" || code === "KeyX" || code === "KeyJ") {
        this.onRunKeyDown();
      } else if (code === "Enter") {
        this.onConfirm();
      } else if (code === "KeyP" || code === "Escape") {
        this.togglePause();
      } else if (code === "KeyM") {
        window.Sound.toggleMute();
        this.syncSoundUI();
      } else if (code === "KeyF") {
        this.toggleFullscreen();
      }
    }

    onKeyUp(event) {
      this.keyDownSet.delete(event.code);
      if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(event.code)) this.syncKeyboardControl();
      if (["Space", "KeyZ", "KeyK", "ArrowUp", "KeyW"].includes(event.code)) this.updateTouchButtons();
    }

    onJumpKeyDown() {
      if (this.state === "title" || this.state === "gameover" || this.state === "win") {
        this.startNewGame();
        return;
      }
      if (this.state === "paused") {
        this.resumeGame();
        return;
      }
      if (this.state === "clear") {
        if (this.stateTimer > 25) this.advanceAfterClear();
        return;
      }
      if (this.state === "playing") this.queueJump();
    }

    onRunKeyDown() {
      if (this.state === "title" || this.state === "gameover" || this.state === "win") {
        this.startNewGame();
        return;
      }
      if (this.state === "paused") {
        this.resumeGame();
        return;
      }
      if (this.state === "playing") this.tryFire();
    }

    onConfirm() {
      if (this.state === "title" || this.state === "gameover" || this.state === "win") {
        this.startNewGame();
      } else if (this.state === "paused") {
        this.resumeGame();
      } else if (this.state === "playing") {
        // Enter does nothing in-game, like the original.
      } else if (this.state === "clear" && this.stateTimer > 25) {
        this.advanceAfterClear();
      }
    }

    onBlur() {
      this.keyDownSet.clear();
      this.syncKeyboardControl();
      if (this.state === "playing") this.pauseGame(true);
    }

    syncKeyboardControl() {
      // Keyboard state is read directly from the Set in readInput().
      this.updateTouchButtons();
    }

    updateTouchButtons() {
      const active = (action) => {
        if (action === "left") return this.touchState.left;
        if (action === "right") return this.touchState.right;
        if (action === "jump") return this.touchState.jump;
        if (action === "run") return this.touchState.run;
        return false;
      };
      document.querySelectorAll(".touch-button").forEach((button) => {
        button.classList.toggle("is-pressed", active(button.dataset.control));
      });
    }

    setTouchControl(action, value) {
      this.touchState[action] = value;
      this.updateTouchButtons();
    }

    queueJump() {
      if (this.state !== "playing") return;
      this.jumpBuffer = JUMP_BUFFER_FRAMES;
    }

    tryFire() {
      if (this.state !== "playing" || !this.player) return;
      this.player.fire();
    }

    readInput() {
      const keys = this.keyDownSet;
      const touch = this.touchState;
      const left = keys.has("ArrowLeft") || keys.has("KeyA") || touch.left;
      const right = keys.has("ArrowRight") || keys.has("KeyD") || touch.right;
      const run = keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyX") || keys.has("KeyJ") || touch.run;
      const jumpHeld = keys.has("Space") || keys.has("KeyZ") || keys.has("KeyK") || keys.has("ArrowUp") || keys.has("KeyW") || touch.jump;
      return { left, right, run, jumpHeld, jumpBuffer: this.jumpBuffer };
    }

    clearInput() {
      this.keyDownSet.clear();
      this.touchState.left = false;
      this.touchState.right = false;
      this.touchState.jump = false;
      this.touchState.run = false;
      this.jumpBuffer = 0;
      this.updateTouchButtons();
    }

    /* ---------------- game flow ---------------- */

    startNewGame() {
      window.Sound.init();
      this.clearInput();
      this.score = 0;
      this.coins = 0;
      this.lives = 3;
      this.levelIndex = 0;
      this.stompCombo = 0;
      this.carriedPower = 0;
      this.didSaveHigh = false;
      this.startLevel(0, 0);
      window.Sound.play("select");
    }

    startLevel(index, power) {
      this.levelIndex = clamp(index, 0, window.LEVELS.length - 1);
      const data = window.LEVELS[this.levelIndex];
      this.level = new GameLevel(data);
      this.player = new Player(this, data.start.x, data.start.y * TILE, power);
      this.player.invuln = 0;
      this.cameraX = 0;
      this.timeLeft = data.time || 400;
      this.timeTicker = 0;
      this.hurryPlayed = false;
      this.jumpBuffer = 0;
      this.stompCombo = 0;
      this.coinEntities = (data.coins || []).map(([x, y], i) => ({
        x: x * TILE,
        y: y * TILE,
        taken: false,
        phase: i * 0.7,
      }));
      this.enemies = (data.enemies || []).map((def) => new Enemy(this, def));
      this.items = [];
      this.fireballs = [];
      this.particles = [];
      this.coinPops = [];
      this.popups = [];
      this.flagPhase = null;
      this.clearBonus = 0;
      this.flagHidden = false;
      this.coinEntities.forEach((coin) => { coin.taken = false; });
      this.state = "intro";
      this.stateTimer = 0;
      this.levelIntroTimer = 0;
      this.starMusicPlaying = false;
      this.clearInput();
      window.Sound.stopMusic();
      this.syncUI();
    }

    advanceLevel() {
      const carried = this.player ? this.player.power : 0;
      if (this.levelIndex + 1 >= window.LEVELS.length) {
        this.enterWinState();
        return;
      }
      this.startLevel(this.levelIndex + 1, carried);
    }

    beginPlaying() {
      this.state = "playing";
      this.stateTimer = 0;
      this.clearInput();
      if (this.level && this.level.data.bgm) {
        window.Sound.startMusic(this.level.data.bgm);
      }
      this.syncUI();
    }

    pauseGame(auto) {
      if (this.state !== "playing") return;
      this.state = "paused";
      this.pauseReason = auto ? "auto" : "manual";
      this.stateTimer = 0;
      this.clearInput();
      window.Sound.pauseMusic();
      if (!auto) window.Sound.play("pause");
      this.syncUI();
    }

    resumeGame() {
      if (this.state !== "paused") return;
      this.state = "playing";
      this.pauseReason = "";
      this.stateTimer = 0;
      this.clearInput();
      window.Sound.resumeMusic();
      window.Sound.play("pause");
      this.syncUI();
      canvas.focus();
    }

    togglePause() {
      if (this.state === "playing") this.pauseGame(false);
      else if (this.state === "paused") this.resumeGame();
    }

    killPlayer(cause) {
      if (this.state !== "playing") return;
      this.state = "dying";
      this.stateTimer = 0;
      this.lives = Math.max(0, this.lives - 1);
      this.player.dead = true;
      this.player.controlLocked = true;
      if (this.player.vy === 0) this.player.vy = -5.2;
      this.player.vx = 0;
      this.player.invuln = 0;
      this.jumpBuffer = 0;
      this.stompCombo = 0;
      window.Sound.stopMusic();
      this.starMusicPlaying = false;
      window.Sound.play("die");
      this.saveHighScore();
      this.syncUI();
    }

    finishLevel() {
      if (!this.level || !this.level.end) return;
      window.Sound.stopMusic();
      window.Sound.setStar(false);
      this.starMusicPlaying = false;
      this.clearBonus = Math.max(0, this.timeLeft) * 50;
      this.addScore(this.clearBonus, 0, 0, true);
      this.level.end.completed = true;
      this.state = "clear";
      this.stateTimer = 0;
      window.Sound.play("clear");
      this.flushHighScore();
      this.syncUI();
    }

    advanceAfterClear() {
      if (this.state !== "clear") return;
      if (this.levelIndex + 1 >= window.LEVELS.length) {
        this.enterWinState();
      } else {
        this.startLevel(this.levelIndex + 1, this.player ? this.player.power : 0);
        window.Sound.play("select");
      }
    }

    enterWinState() {
      this.state = "win";
      this.stateTimer = 0;
      this.flagHidden = false;
      this.winScene = {
        fireworks: [],
        confetti: [],
        timer: 0,
        nextFire: 20,
        marioWalk: 0,
      };
      window.Sound.stopMusic();
      this.saveHighScore();
      this.syncUI();
    }

    /* ---------------- in-game updates ---------------- */

    updatePlaying() {
      const level = this.level;
      const player = this.player;
      if (!level || !player) return;

      const input = this.readInput();
      player.update(input);
      this.jumpBuffer = Math.max(0, this.jumpBuffer - 1);
      if (this.player.starTimer > 0 && !this.starMusicPlaying) {
        window.Sound.setStar(true);
        this.starMusicPlaying = true;
      }

      if (this.state !== "playing") return;

      level.updateBumps();
      this.updateEnemies();
      if (this.state !== "playing") return;
      this.handleEnemyCollisions();
      if (this.state !== "playing") return;
      this.updateItems();
      this.updateCoins();
      this.updateFireballs();
      this.updateParticles();
      this.updateCoinPops();
      this.updatePopups();
      this.updateCamera();
      this.checkFinishTrigger();
      if (this.state !== "playing") return;
      this.updateTimer();
      if (this.state !== "playing") return;

      if (this.player.starTimer > 0 && this.frames % 2 === 0) {
        this.spawnStarSparkle();
      }
      if (this.starMusicPlaying && this.player.starTimer === 0) {
        window.Sound.setStar(false);
        this.starMusicPlaying = false;
      }
    }

    updateEnemies() {
      const cameraLimit = this.cameraX + VIEW_W + 32;
      for (const enemy of this.enemies) {
        if (!enemy.active && !enemy.dead && enemy.x < cameraLimit && enemy.x > this.cameraX - 40) {
          enemy.activate();
        }
        if (enemy.active) enemy.update(this.level);
      }

      // Moving shells wipe out other enemies.
      for (const shell of this.enemies) {
        if (!shell.active || shell.dead || shell.flipped) continue;
        if (shell.type !== "koopa" || shell.state !== "shellMove") continue;
        for (const other of this.enemies) {
          if (other === shell || !other.active || other.dead || other.flipped || other.squashedTimer > 0) continue;
          if (overlaps(this.enemyBox(shell), this.enemyBox(other))) {
            other.kill(Math.sign(shell.vx) || 1, true);
            other.flippedTimer = 100;
            this.addScore(500);
            this.spawnSparkle(other.x + 7, other.y + 8, "#fff6b0");
            this.sound("kick");
          }
        }
      }

      this.enemies = this.enemies.filter((enemy) => {
        if (enemy.dead) return false;
        if (enemy.active && enemy.x < this.cameraX - 160) return false;
        return true;
      });
    }

    enemyBox(enemy) {
      return {
        x: enemy.x + 1,
        y: enemy.y + 1,
        w: enemy.w - 2,
        h: enemy.h - 2,
      };
    }

    handleEnemyCollisions() {
      const player = this.player;
      if (!player || player.controlLocked) return;
      const pbox = {
        x: player.x + 1,
        y: player.y + 2,
        w: player.w - 2,
        h: player.h - 3,
      };

      for (const enemy of this.enemies) {
        if (!enemy.active || enemy.dead || enemy.flipped || enemy.squashedTimer > 0) continue;
        if (enemy.grace > 0) continue;
        const ebox = this.enemyBox(enemy);
        if (!overlaps(pbox, ebox)) continue;

        if (player.starTimer > 0) {
          enemy.kill(Math.sign(player.x + player.w / 2 - (enemy.x + enemy.w / 2)) || 1, true);
          this.addScore(200);
          this.spawnSparkle(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffe66a");
          this.sound("kick");
          continue;
        }

        const prevBottom = player.prevY + player.h;
        const stomping = player.vy > 0 && prevBottom <= enemy.y + 8;

        if (stomping) {
          this.stompEnemy(enemy);
          continue;
        }

        if (player.invuln > 0) continue;

        if (enemy.type === "koopa" && enemy.state === "shell" && Math.abs(enemy.vx) < 0.01) {
          const direction = player.x + player.w / 2 < enemy.x + enemy.w / 2 ? 1 : -1;
          enemy.kick(direction);
          this.addScore(100);
          continue;
        }

        player.hurt();
        return;
      }
    }

    stompEnemy(enemy) {
      const player = this.player;
      if (!player) return;
      const chain = [100, 200, 400, 500, 800, 1000, 2000, 4000, 8000];
      if (this.stompCombo >= 9) {
        this.lives++;
        this.spawnPopup(player.x + player.w / 2, player.y - 6, "1UP", "#bfffa0");
        this.sound("1up");
      } else {
        this.addScore(chain[Math.min(this.stompCombo, chain.length - 1)]);
      }
      this.stompCombo++;

      enemy.stomp();
      player.y = enemy.y - player.h + 1;
      player.vy = player.jumpHeld ? -5.0 : -3.9;
      player.onGround = false;
      this.addScore(0);
      this.spawnDust(enemy.x + enemy.w / 2, enemy.y + enemy.h - 2, 0);
      this.spawnSparkle(enemy.x + enemy.w / 2, enemy.y + 2, "#fff6c0");
    }

    updateItems() {
      for (const item of this.items) {
        item.update(this.level);
        if (item.remove) continue;
        if (item.emerging) continue;
        const box = { x: item.x + 1, y: item.y + 1, w: item.w - 2, h: item.h - 2 };
        const pbox = {
          x: this.player.x + 1,
          y: this.player.y + 2,
          w: this.player.w - 2,
          h: this.player.h - 3,
        };
        if (overlaps(box, pbox)) {
          this.collectItem(item);
        }
      }
      this.items = this.items.filter((item) => !item.remove);
    }

    collectItem(item) {
      item.remove = true;
      this.sound("powerup");
      const player = this.player;

      if (item.type === "mushroom" || item.type === "1up") {
        if (item.type === "1up") {
          this.lives++;
          this.spawnPopup(player.x + player.w / 2, player.y - 4, "1UP", "#bfffa0");
          this.sound("1up");
        } else if (player.power === 0) {
          const feet = player.feet;
          player.power = 1;
          player.h = PLAYER_H_BIG;
          player.y = feet - player.h;
          this.addScore(1000);
          this.spawnPowerBurst(player.x + player.w / 2, player.y + player.h / 2);
        } else {
          this.addScore(1000);
          this.spawnPowerBurst(player.x + player.w / 2, player.y + player.h / 2);
        }
      } else if (item.type === "flower") {
        const wasSmall = player.power === 0;
        const feet = player.feet;
        player.power = 2;
        player.h = PLAYER_H_BIG;
        player.y = feet - player.h;
        this.addScore(1000);
        this.spawnPowerBurst(player.x + player.w / 2, player.y + player.h / 2);
        if (wasSmall) this.spawnPopup(player.x + player.w / 2, player.y - 4, "FIRE!", "#ffb44a");
      } else if (item.type === "star") {
        player.starTimer = 660;
        this.addScore(1000);
        this.spawnPowerBurst(player.x + player.w / 2, player.y + player.h / 2);
      }
    }

    updateCoins() {
      const pbox = {
        x: this.player.x,
        y: this.player.y + 1,
        w: this.player.w,
        h: this.player.h - 2,
      };
      for (const coin of this.coinEntities) {
        if (coin.taken) continue;
        const cbox = { x: coin.x + 3, y: coin.y + 2, w: 10, h: 12 };
        if (overlaps(pbox, cbox)) {
          coin.taken = true;
          this.addCoin();
          this.addScore(200);
          this.sound("coin");
          this.spawnSparkle(coin.x + 8, coin.y + 8, "#ffe873");
          this.spawnSparkle(coin.x + 8, coin.y + 8, "#fff8c8");
        }
      }
    }

    updateFireballs() {
      for (const ball of this.fireballs) {
        ball.update(this.level);
        if (ball.remove) continue;
        const bbox = { x: ball.x + 1, y: ball.y + 1, w: ball.w - 2, h: ball.h - 2 };
        for (const enemy of this.enemies) {
          if (!enemy.active || enemy.dead || enemy.flipped || enemy.squashedTimer > 0) continue;
          if (overlaps(bbox, this.enemyBox(enemy))) {
            enemy.kill(Math.sign(ball.vx) || 1, true);
            this.addScore(200);
            this.spawnFireSpark(ball.x, ball.y);
            this.sound("kick");
            ball.remove = true;
            break;
          }
        }
      }
      this.fireballs = this.fireballs.filter((ball) => !ball.remove);
    }

    updateParticles() {
      for (const particle of this.particles) {
        particle.life--;
        particle.vy += particle.gravity || 0;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rot += particle.rotV || 0;
        if (particle.life <= 0) particle.dead = true;
      }
      this.particles = this.particles.filter((particle) => !particle.dead);
    }

    updateCoinPops() {
      for (const coin of this.coinPops) {
        coin.vy += 0.24;
        coin.y += coin.vy;
        coin.life--;
      }
      this.coinPops = this.coinPops.filter((coin) => coin.life > 0);
    }

    updatePopups() {
      for (const popup of this.popups) {
        popup.life--;
        popup.y -= 0.35;
      }
      this.popups = this.popups.filter((popup) => popup.life > 0);
    }

    updateCamera() {
      if (!this.player || !this.level) return;
      const maxCamera = Math.max(0, this.level.width * TILE - VIEW_W);
      const target = clamp(this.player.x - 92, 0, maxCamera);
      if (target > this.cameraX) {
        this.cameraX = clamp(target, 0, maxCamera);
      }
      if (this.player.x < this.cameraX) this.player.x = this.cameraX;
    }

    updateTimer() {
      this.timeTicker++;
      if (this.timeTicker >= 24) {
        this.timeTicker = 0;
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        if (this.timeLeft === 100) {
          this.hurryPlayed = true;
          this.sound("hurry");
        } else if (this.timeLeft <= 10 && this.timeLeft > 0) {
          this.sound("tick");
        }
        if (this.timeLeft <= 0) {
          this.killPlayer("time");
        }
      }
    }

    checkFinishTrigger() {
      const end = this.level && this.level.end;
      const player = this.player;
      if (!end || !player || this.state !== "playing") return;

      if (end.type === "flag") {
        if (
          player.x + player.w > end.poleX - 2 &&
          player.x < end.poleX + 7 &&
          player.y + player.h > 62 &&
          player.y < end.groundY
        ) {
          this.startFlagSequence(end);
        }
      } else if (end.type === "pipe") {
        const centerX = player.x + player.w / 2;
        const onTop = player.onGround &&
          Math.abs(player.feet - end.pipeTop) < 3 &&
          centerX > end.pipeX + 2 &&
          centerX < end.pipeX + 30;
        const pastPipe = player.onGround && player.x > end.pipeX + 26;
        if (onTop || pastPipe) {
          this.startPipeExit(end);
        }
      }
    }

    startFlagSequence(end) {
      if (this.state !== "playing") return;
      const player = this.player;
      window.Sound.stopMusic();
      window.Sound.setStar(false);
      this.starMusicPlaying = false;
      this.state = "flag";
      this.stateTimer = 0;
      this.flagHidden = false;
      const ratio = clamp((end.groundY - (player.y + player.h)) / 144, 0, 1);
      const bonusTable = [100, 200, 400, 800, 1000, 2000, 4000, 5000];
      this.flagScore = bonusTable[Math.min(bonusTable.length - 1, Math.floor(ratio * bonusTable.length))];
      this.addScore(this.flagScore);
      this.flagPhase = {
        phase: "slide",
        timer: 0,
        wait: 0,
        walkTimer: 0,
        playerStartY: player.y,
        flagStartY: end.flagY,
        flagTargetY: end.groundY - 31,
        lastWalkFrame: 0,
        scoreShown: false,
      };
      player.controlLocked = true;
      player.vx = 0;
      player.vy = 0;
      player.x = end.poleX - player.w + 1;
      player.facing = 1;
      this.sound("flag");
      this.spawnSparkle(player.x + 8, player.y + 8, "#fff8c0");
      this.syncUI();
    }

    startPipeExit(end) {
      if (this.state !== "playing") return;
      const player = this.player;
      window.Sound.stopMusic();
      window.Sound.setStar(false);
      this.starMusicPlaying = false;
      this.state = "pipeClear";
      this.stateTimer = 0;
      this.flagHidden = false;
      this.flagPhase = {
        phase: "sink",
        timer: 0,
        pipeTop: end.pipeTop,
      };
      player.controlLocked = true;
      player.vx = 0;
      player.vy = 0;
      player.x = end.pipeX + 1 + (32 - player.w) / 2;
      this.sound("pipe");
      this.syncUI();
    }

    updateFlagState() {
      const player = this.player;
      const end = this.level.end;
      const phase = this.flagPhase;
      if (!phase) return;
      this.stateTimer++;

      if (phase.phase === "slide") {
        player.x = end.poleX - player.w + 1;
        player.vy = 0;
        player.y += 2.2;
        if (player.y + player.h >= end.groundY) {
          player.y = end.groundY - player.h;
          phase.phase = "wait";
          phase.timer = 0;
        }
        const target = phase.flagTargetY;
        end.flagY = Math.min(target, end.flagY + 2.4);
      } else if (phase.phase === "wait") {
        phase.timer++;
        end.flagY = Math.min(phase.flagTargetY, end.flagY + 2.4);
        if (phase.timer > 28) {
          phase.phase = "walk";
          phase.timer = 0;
          player.controlLocked = true;
        }
      } else if (phase.phase === "walk") {
        phase.timer++;
        end.flagY = phase.flagTargetY;
        player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
        player.y = Math.min(end.groundY - player.h, player.y + player.vy);
        player.vx = 1.25;
        player.facing = 1;
        player.x += player.vx;
        player.walkTimer += player.vx;
        this.updateCamera();
        const door = end.castleX + 40;
        if (player.x >= door - 4) {
          phase.phase = "castle";
          phase.timer = 0;
          this.flagHidden = true;
          end.castleFlag = 0;
        }
      } else if (phase.phase === "castle") {
        phase.timer++;
        end.castleFlag = Math.min(1, phase.timer / 36);
        this.updateCamera();
        if (phase.timer > 80) {
          this.finishLevel();
        }
      }
    }

    updatePipeClear() {
      this.stateTimer++;
      const end = this.level.end;
      const player = this.player;
      player.y += 1.15;
      if (this.stateTimer > 34) this.flagHidden = true;
      if (this.stateTimer > 72) {
        this.finishLevel();
      }
      if (end && end.castleFlag != null) end.castleFlag = 0;
    }

    updateDying() {
      this.stateTimer++;
      const player = this.player;
      if (!player) return;
      if (this.player.y < VIEW_H + 30) {
        player.vy = Math.min(player.vy + 0.22, MAX_FALL);
        player.y += player.vy;
      }
      if (this.stateTimer > 140) {
        if (this.lives > 0) {
          window.Sound.stopMusic();
          this.startLevel(this.levelIndex, 0);
          window.Sound.play("select");
        } else {
          this.state = "gameover";
          this.stateTimer = 0;
          window.Sound.stopMusic();
          window.Sound.play("gameover");
          this.saveHighScore();
          this.syncUI();
        }
      }
    }

    updateClear() {
      this.stateTimer++;
      if (this.stateTimer > 225) this.advanceAfterClear();
    }

    updateWinScene() {
      this.stateTimer++;
      const scene = this.winScene;
      if (!scene) return;
      scene.timer++;
      scene.nextFire--;

      if (scene.nextFire <= 0 && scene.timer < 240) {
        scene.nextFire = 34 + Math.floor(Math.random() * 38);
        const fx = 28 + Math.random() * 200;
        const fy = 70 + Math.random() * 80;
        const colors = ["#ffd447", "#ff6b6b", "#7ce8ff", "#b6ff8a", "#ff82e8"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        scene.fireworks.push({ x: fx, y: fy, life: 40, maxLife: 40, color, seed: Math.random() * 10 });
        this.sound("coin");
      }

      for (const firework of scene.fireworks) {
        firework.life--;
        if (Math.random() < 0.25) {
          scene.confetti.push({
            x: firework.x,
            y: firework.y,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
            life: 30 + Math.random() * 30,
            color: firework.color,
          });
        }
      }
      scene.fireworks = scene.fireworks.filter((firework) => firework.life > 0);
      for (const c of scene.confetti) {
        c.life--;
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.025;
      }
      scene.confetti = scene.confetti.filter((c) => c.life > 0);
    }

    /* ---------------- interactions ---------------- */

    onPlayerJump() {
      if (!this.player) return;
      this.sound(this.player.power > 0 ? "bigJump" : "jump");
      this.spawnDust(this.player.x + this.player.w / 2, this.player.feet, 0);
    }

    onPlayerLand(impact) {
      if (!this.player) return;
      this.stompCombo = 0;
      if (impact > 2.4) {
        this.spawnDust(this.player.x + 3, this.player.feet - 1, -1);
        this.spawnDust(this.player.x + this.player.w - 3, this.player.feet - 1, 1);
      }
    }

    onPlayerDamaged() {
      window.Sound.play("powerdown");
      this.spawnPowerBurst(this.player.x + this.player.w / 2, this.player.y + 8);
      this.addScore(0);
    }

    onStarEnded() {
      if (this.starMusicPlaying) {
        window.Sound.setStar(false);
        this.starMusicPlaying = false;
      }
    }

    onHeadButt(tx, ty) {
      const tile = this.level.tileAt(tx, ty);
      if (!tile) return;
      const player = this.player;
      this.level.addBump(tx, ty);

      if (tile.type === "question" && tile.item) {
        tile.type = "used";
        if (tile.item === "coin") {
          this.addCoin();
          this.addScore(200);
          this.coinPops.push({ x: tx * TILE, y: ty * TILE - 16, vy: -3.8, life: 34 });
          this.sound("coin");
          this.spawnSparkle(tx * TILE + 8, ty * TILE, "#ffe873");
        } else {
          let kind = tile.item;
          if (kind === "power") kind = player.power === 0 ? "mushroom" : "flower";
          this.items.push(new Item(this, kind, tx, ty * TILE));
          this.sound("powerupAppear");
        }
        this.bumpEnemiesAbove(tx, ty);
        this.spawnBlockBits(tx, ty, 3);
        return;
      }

      if (tile.type === "brick") {
        if (player.power > 0) {
          this.level.removeTile(tx, ty);
          this.sound("break");
          this.addScore(50);
          this.spawnBrickParticles(tx, ty);
          this.bumpEnemiesAbove(tx, ty);
          player.vy = 0;
        } else {
          this.sound("bump");
          this.spawnBlockBits(tx, ty, 2);
          this.bumpEnemiesAbove(tx, ty);
        }
        return;
      }

      if (tile.type === "used" || tile.type === "hard") {
        this.sound("bump");
        this.spawnBlockBits(tx, ty, 1);
        this.bumpEnemiesAbove(tx, ty);
      } else if (tile.type === "pipe") {
        this.sound("bump");
      }
    }

    bumpEnemiesAbove(tx, ty) {
      const box = { x: tx * TILE, y: ty * TILE - 12, w: TILE, h: 16 };
      for (const enemy of this.enemies) {
        if (!enemy.active || enemy.dead || enemy.flipped) continue;
        if (overlaps(box, { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h })) {
          enemy.kill(1, true);
          this.addScore(100);
          this.spawnSparkle(enemy.x + enemy.w / 2, enemy.y + 4, "#fff8c0");
        }
      }
    }

    updateCameraDuringSequence() {
      this.updateCamera();
    }

    spawnFireball(player) {
      const dir = player.facing;
      const x = dir > 0 ? player.x + player.w + 2 : player.x - 10;
      const y = player.y + (player.power > 0 ? 13 : 6);
      this.fireballs.push(new Fireball(this, x, y, dir * 3.15, -1.5));
      this.sound("fireball");
      this.spawnFireSpark(x, y + 4);
    }

    collectCoinValue(count) {
      for (let i = 0; i < (count || 1); i++) this.addCoin();
    }

    addCoin() {
      this.coins++;
      if (this.coins >= 100) {
        this.coins -= 100;
        this.lives++;
        this.sound("1up");
        this.spawnPopup(this.player ? this.player.x + 6 : 128, this.player ? this.player.y - 6 : 120, "1UP", "#bfffa0");
      }
    }

    addScore(amount, x, y, silent) {
      if (!amount) return;
      this.score = Math.min(999999, this.score + amount);
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
      if (!silent) this.flushHighScore(false);
    }

    saveHighScore() {
      this.highScore = Math.max(this.highScore, this.score);
      saveNumber("mario-highscore", this.highScore);
      this.didSaveHigh = true;
    }

    flushHighScore(force) {
      if (force || this.frames % 60 === 0) {
        this.highScore = Math.max(this.highScore, this.score);
        saveNumber("mario-highscore", this.highScore);
      }
    }

    spawnPopup(x, y, text, color) {
      this.popups.push({ x, y, text, color: color || "#ffffff", life: 52, maxLife: 52 });
    }

    spawnStarSparkle() {
      const player = this.player;
      if (!player) return;
      const colors = ["#ffe66a", "#ff8a6a", "#8af0ff", "#d4ff8a"];
      this.particles.push({
        x: player.x + Math.random() * player.w,
        y: player.y + Math.random() * player.h,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.4 - Math.random() * 0.7,
        life: 18 + Math.random() * 12,
        maxLife: 30,
        size: 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.01,
      });
    }

    spawnDust(x, y, dir) {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 7,
          y: y - Math.random() * 2,
          vx: (dir || (Math.random() - 0.5)) * 0.65 + (Math.random() - 0.5) * 0.3,
          vy: -0.25 - Math.random() * 0.5,
          life: 14 + Math.random() * 8,
          maxLife: 22,
          size: 2 + Math.floor(Math.random() * 2),
          color: "#f2e6c8",
          gravity: 0.02,
        });
      }
    }

    spawnSparkle(x, y, color) {
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.45 + Math.random() * 1.2;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.3,
          life: 14 + Math.random() * 12,
          maxLife: 26,
          size: Math.random() > 0.5 ? 2 : 1,
          color: color || "#ffe873",
          gravity: 0.03,
        });
      }
    }

    spawnPowerBurst(x, y) {
      const colors = ["#ffe873", "#fff8d0", "#ffb347", "#ffffff"];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
        const speed = 0.7 + Math.random() * 1.3;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 22 + Math.random() * 16,
          maxLife: 38,
          size: Math.random() > 0.4 ? 2 : 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: 0.015,
        });
      }
    }

    spawnFireSpark(x, y) {
      const colors = ["#ffe16a", "#ff7a1a", "#ffb347"];
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 1.4,
          vy: (Math.random() - 0.5) * 1.4 - 0.2,
          life: 10 + Math.random() * 10,
          maxLife: 20,
          size: 1 + Math.floor(Math.random() * 2),
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: 0.02,
        });
      }
    }

    spawnBlockBits(tx, ty, count) {
      const palette = window.Art.THEMES[this.level.theme] || window.Art.THEMES.overworld;
      for (let i = 0; i < (count || 3); i++) {
        this.particles.push({
          x: tx * TILE + 4 + Math.random() * 8,
          y: ty * TILE + 2 + Math.random() * 5,
          vx: (Math.random() - 0.5) * 1.1,
          vy: -0.5 - Math.random() * 1.1,
          life: 18 + Math.random() * 12,
          maxLife: 30,
          size: 2,
          color: Math.random() > 0.5 ? palette.qShine : palette.brickHi,
          gravity: 0.15,
        });
      }
    }

    spawnBrickParticles(tx, ty) {
      const palette = window.Art.THEMES[this.level.theme] || window.Art.THEMES.overworld;
      const colors = [palette.brick, palette.brickDark, palette.brickLight, palette.brickHi];
      for (let i = 0; i < 6; i++) {
        this.particles.push({
          x: tx * TILE + 3 + Math.random() * 10,
          y: ty * TILE + 3 + Math.random() * 10,
          vx: (Math.random() - 0.5) * 2.8,
          vy: -2.2 - Math.random() * 2.6,
          life: 35 + Math.random() * 25,
          maxLife: 60,
          size: 2 + Math.floor(Math.random() * 3),
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: 0.27,
          rot: Math.random() * Math.PI,
          rotV: (Math.random() - 0.5) * 0.3,
        });
      }
    }

    sound(name) {
      if (window.Sound && window.Sound.play) window.Sound.play(name);
    }

    /* ---------------- UI glue ---------------- */

    syncUI() {
      const pauseButton = document.getElementById("pauseButton");
      if (pauseButton) {
        const paused = this.state === "paused";
        const label = pauseButton.querySelector(".tool-label");
        const icon = pauseButton.querySelector(".tool-icon");
        if (label) label.textContent = paused ? "继续" : "暂停";
        if (icon) icon.textContent = paused ? "▶" : "Ⅱ";
        pauseButton.classList.toggle("is-off", this.state !== "playing" && !paused);
      }
      const startable = this.state === "title" || this.state === "gameover" || this.state === "win";
      canvas.classList.toggle("is-startable", startable);
      if (this.debugMode) {
        canvas.dataset.state = this.state;
        canvas.dataset.level = this.level ? this.level.data.id : "";
      }
    }

    syncSoundUI() {
      const button = document.getElementById("soundButton");
      if (!button) return;
      const label = button.querySelector(".tool-label");
      const icon = button.querySelector(".tool-icon");
      const muted = window.Sound.muted;
      if (label) label.textContent = muted ? "静音" : "声音开";
      if (icon) icon.textContent = muted ? "×" : "♪";
      button.setAttribute("aria-pressed", muted ? "false" : "true");
      button.classList.toggle("is-off", muted);
    }

    syncFullscreenUI() {
      const button = document.getElementById("fullscreenButton");
      if (!button) return;
      const label = button.querySelector(".tool-label");
      if (label) label.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
    }

    toggleFullscreen() {
      const shell = document.querySelector(".game-shell");
      if (!document.fullscreenEnabled) return;
      if (!document.fullscreenElement) {
        shell.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }

    /* ---------------- main loop ---------------- */

    frame(timestamp) {
      if (!this.lastFrame) this.lastFrame = timestamp;
      let delta = timestamp - this.lastFrame;
      this.lastFrame = timestamp;
      if (delta > 120) delta = 120;
      this.accumulator += delta;
      const step = 1000 / 60;
      let iterations = 0;
      while (this.accumulator >= step && iterations < 5) {
        this.update();
        this.accumulator -= step;
        iterations++;
      }
      this.render(timestamp);
      requestAnimationFrame((ts) => this.frame(ts));
    }

    update() {
      this.frames++;
      this.clock = this.frames * (1000 / 60);
      this.stateTimer++;

      switch (this.state) {
        case "title":
          this.updateTitle();
          break;
        case "intro":
          this.updateIntro();
          break;
        case "playing":
          this.updatePlaying();
          break;
        case "paused":
          break;
        case "dying":
          this.updateDying();
          break;
        case "flag":
          this.updateFlagState();
          break;
        case "pipeClear":
          this.updatePipeClear();
          break;
        case "clear":
          this.updateClear();
          break;
        case "gameover":
          break;
        case "win":
          this.updateWinScene();
          break;
        default:
          break;
      }
    }

    updateTitle() {
      this.titleSeed = this.frames;
    }

    updateIntro() {
      this.levelIntroTimer++;
      if (this.stateTimer >= 116) {
        this.beginPlaying();
      }
    }

    /* ---------------- rendering ---------------- */

    render(timestamp) {
      ctx.imageSmoothingEnabled = false;
      if (this.state === "title") {
        this.renderTitle();
      } else if (this.state === "intro") {
        this.renderIntro();
      } else if (this.state === "gameover") {
        this.renderGameOver();
      } else if (this.state === "win") {
        this.renderWin();
      } else {
        this.renderWorld();
        if (this.state === "paused") this.renderPauseOverlay();
        else if (this.state === "clear") this.renderClearOverlay();
      }
    }

    renderWorld() {
      const camera = Math.round(this.cameraX);
      window.Art.drawBackground(ctx, this.level, camera, this.clock);
      if (this.level.end.type === "flag") {
        window.Art.drawCastle(
          ctx,
          this.level.theme,
          this.level.end.castleX - camera,
          this.level.end.groundY,
          this.level.end.castleFlag
        );
      }

      this.drawCoins(camera);
      this.drawItems(camera);
      this.drawTiles(camera);
      if (this.level.end.type === "flag") {
        window.Art.drawFlagpole(
          ctx,
          { x: this.level.end.poleX - camera, groundY: this.level.end.groundY },
          this.level.end.flagY,
          this.level.theme
        );
      } else {
        this.drawPipeHint(camera);
      }
      this.drawEnemies(camera);
      this.drawFireballs(camera);
      this.drawPlayer(camera);
      this.drawParticles(camera);
      this.drawCoinPops(camera);
      this.drawPopups(camera);
      this.drawHUD();
    }

    drawTiles(camera) {
      const level = this.level;
      const x0 = Math.max(0, Math.floor(camera / TILE) - 1);
      const x1 = Math.min(level.width - 1, Math.ceil((camera + VIEW_W) / TILE) + 1);
      for (let ty = 0; ty < level.height; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const tile = level.tiles[ty][tx];
          if (!tile) continue;
          const drawType = tile.type === "pipe" ? tile.part : tile.type;
          const image = window.Art.getTile(level.theme, drawType, tx, ty, this.clock);
          let bumpY = 0;
          if (tile.bump > 0) {
            bumpY = -Math.round(Math.sin((1 - tile.bump / BUMP_FRAMES) * Math.PI) * 6);
          }
          ctx.drawImage(image, Math.round(tx * TILE - camera), Math.round(ty * TILE + bumpY));
        }
      }
    }

    drawCoins(camera) {
      for (const coin of this.coinEntities) {
        if (coin.taken) continue;
        const sx = coin.x - camera;
        if (sx < -20 || sx > VIEW_W + 20) continue;
        const frame = Math.floor(this.frames * 0.12 + coin.phase) % 6;
        window.Art.drawCoin(ctx, sx, coin.y, frame);
      }
    }

    drawItems(camera) {
      for (const item of this.items) {
        if (item.remove) continue;
        const sx = Math.round(item.x - camera);
        if (sx < -24 || sx > VIEW_W + 24) continue;
        if (item.type === "mushroom") window.Art.drawMushroom(ctx, sx, item.y, false);
        else if (item.type === "1up") window.Art.drawMushroom(ctx, sx, item.y, true);
        else if (item.type === "flower") window.Art.drawFireFlower(ctx, sx, item.y, this.clock);
        else if (item.type === "star") window.Art.drawStarItem(ctx, sx, item.y, this.clock);
      }
    }

    drawEnemies(camera) {
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        const sx = Math.round(enemy.x - camera - 1);
        if (sx < -32 || sx > VIEW_W + 32) continue;

        if (enemy.type === "goomba") {
          if (enemy.squashedTimer > 0) {
            window.Art.drawGoomba(ctx, sx, Math.round(enemy.y + enemy.h - 10), 0, true);
          } else if (enemy.flipped) {
            ctx.save();
            ctx.translate(sx, Math.round(enemy.y + enemy.h));
            ctx.scale(1, -1);
            window.Art.drawGoomba(ctx, 0, 0, enemy.frame, false);
            ctx.restore();
          } else {
            window.Art.drawGoomba(ctx, sx, Math.round(enemy.y), enemy.frame, false);
          }
        } else {
          if (enemy.flipped) {
            ctx.save();
            ctx.translate(sx, Math.round(enemy.y + enemy.h));
            ctx.scale(1, -1);
            window.Art.drawKoopa(ctx, 0, 0, enemy.frame, enemy.state, enemy.facing);
            ctx.restore();
          } else {
            window.Art.drawKoopa(ctx, sx, Math.round(enemy.y), enemy.frame, enemy.state, enemy.facing);
          }
        }
      }
    }

    drawFireballs(camera) {
      for (const ball of this.fireballs) {
        if (ball.remove) continue;
        const sx = Math.round(ball.x - camera);
        if (sx < -12 || sx > VIEW_W + 12) continue;
        window.Art.drawFireball(ctx, sx, Math.round(ball.y), ball.anim, Math.sign(ball.vx));
      }
    }

    drawPlayer(camera) {
      const player = this.player;
      if (!player || !player.visible) return;
      if (this.flagHidden) return;
      if (this.state === "pipeClear" && this.stateTimer > 34) return;

      let pose = "stand";
      if (this.state === "dying") {
        pose = "dead";
      } else if (this.state === "flag") {
        pose = this.flagPhase && (this.flagPhase.phase === "walk" || this.flagPhase.phase === "wait") ? "walk1" : "walk2";
      } else if (!player.onGround) {
        pose = "jump";
      } else if (player.skidding) {
        pose = "skid";
      } else if (Math.abs(player.vx) > 0.1) {
        pose = player.animFrame ? "walk2" : "walk1";
      }

      if (this.state !== "dying" && player.invuln > 0 && player.starTimer <= 0 && Math.floor(this.frames / 3) % 2 === 0) {
        return;
      }

      const sx = player.x - camera;
      const sy = player.y;
      const power = this.state === "dying" ? 0 : player.power;
      const options = {
        x: sx,
        y: sy,
        power,
        pose,
        facing: player.facing,
        star: player.starTimer > 0,
        starTime: this.frames,
      };

      if (this.state === "pipeClear") {
        const top = this.level.end.pipeTop;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, VIEW_W, Math.max(0, top + 2));
        ctx.clip();
        window.Art.drawMario(ctx, options);
        ctx.restore();
      } else {
        window.Art.drawMario(ctx, options);
      }
    }

    drawParticles(camera) {
      for (const p of this.particles) {
        const sx = Math.round(p.x - camera);
        if (sx < -20 || sx > VIEW_W + 20) continue;
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.rot) {
          ctx.save();
          ctx.translate(sx, Math.round(p.y));
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        } else {
          ctx.fillRect(sx, Math.round(p.y), p.size, p.size);
        }
        ctx.globalAlpha = 1;
      }
    }

    drawCoinPops(camera) {
      for (const coin of this.coinPops) {
        window.Art.drawCoin(ctx, Math.round(coin.x - camera), Math.round(coin.y), Math.floor(this.frames / 3) % 6);
      }
    }

    drawPopups(camera) {
      for (const popup of this.popups) {
        const alpha = clamp(popup.life / 20, 0, 1);
        ctx.globalAlpha = alpha;
        window.Art.drawText(ctx, popup.text, popup.x - camera, popup.y, {
          scale: 1,
          align: "center",
          color: popup.color,
          shadow: "#1b0a07",
          shadowOffset: 1,
        });
        ctx.globalAlpha = 1;
      }
    }

    drawPipeHint(camera) {
      const end = this.level.end;
      if (!end || end.type !== "pipe" || !end.hint) return;
      if (end.completed || this.state === "clear" || this.state === "pipeClear") return;
      const sx = end.pipeX - camera;
      if (sx < -80 || sx > VIEW_W + 80) return;
      const bob = Math.round(Math.sin(this.frames * 0.08) * 2);
      const ax = Math.round(sx + 16);
      const ay = end.pipeTop - 36 + bob;
      ctx.fillStyle = "rgba(24, 12, 5, 0.85)";
      ctx.fillRect(ax - 1, ay, 2, 7);
      for (let row = 0; row < 5; row++) {
        ctx.fillRect(ax - 4 + row, ay + 7 + row, 8 - row * 2, 1);
      }
      ctx.fillStyle = "#ffd447";
      ctx.fillRect(ax - 1, ay, 2, 6);
      for (let row = 0; row < 4; row++) {
        ctx.fillRect(ax - 3 + row, ay + 7 + row, 6 - row * 2, 1);
      }
      ctx.fillStyle = "#fff5b0";
      ctx.fillRect(ax - 1, ay + 1, 1, 4);

      // A small exit sign, in the same handmade pixel style as everything else.
      const signX = sx - 42;
      const baseY = GROUND_TOP - 1;
      const pal = window.Art.THEMES[this.level.theme] || window.Art.THEMES.overworld;
      ctx.fillStyle = pal.outline;
      ctx.fillRect(signX + 18, baseY - 17, 3, 17);
      ctx.fillStyle = "#7b4a22";
      ctx.fillRect(signX + 19, baseY - 17, 1, 17);
      ctx.fillStyle = pal.outline;
      ctx.fillRect(signX, baseY - 35, 40, 20);
      ctx.fillStyle = "#f3d38b";
      ctx.fillRect(signX + 2, baseY - 33, 36, 16);
      ctx.fillStyle = "#b8843d";
      ctx.fillRect(signX + 2, baseY - 21, 36, 4);
      window.Art.drawText(ctx, "EXIT", signX + 11, baseY - 30, {
        scale: 1,
        color: "#4a2a0d",
        shadow: "#ffe7b0",
        shadowOffset: 0,
      });
    }

    drawHUD() {
      const shadow = "#0b0808";
      window.Art.drawText(ctx, "MARIO", 24, 8, { color: "#ffffff", shadow, shadowOffset: 1 });
      window.Art.drawText(ctx, pad(this.score, 6), 24, 17, { color: "#ffffff", shadow, shadowOffset: 1 });

      // HUD coin icon — solid enough to read at 1× pixel size.
      ctx.fillStyle = "#5b3200";
      ctx.fillRect(93, 16, 7, 8);
      ctx.fillStyle = "#ffd83e";
      ctx.fillRect(94, 17, 5, 6);
      ctx.fillStyle = "#fff2a0";
      ctx.fillRect(95, 18, 1, 3);
      ctx.fillStyle = "#b97800";
      ctx.fillRect(98, 18, 1, 3);
      window.Art.drawText(ctx, "×" + pad(this.coins, 2), 102, 17, { color: "#ffffff", shadow, shadowOffset: 1 });

      window.Art.drawText(ctx, "WORLD", 149, 8, { color: "#ffffff", shadow, shadowOffset: 1 });
      window.Art.drawText(ctx, this.level ? this.level.data.id : "1-1", 159, 17, { color: "#ffffff", shadow, shadowOffset: 1 });

      window.Art.drawText(ctx, "TIME", 213, 8, { color: "#ffffff", shadow, shadowOffset: 1 });
      const timeColor = this.timeLeft <= 100 && Math.floor(this.frames / 8) % 2 === 0 ? "#ff8b6a" : "#ffffff";
      window.Art.drawText(ctx, pad(this.timeLeft, 3), 214, 17, { color: timeColor, shadow, shadowOffset: 1 });
    }

    renderTitle() {
      const fakeCamera = 28;
      window.Art.drawBackground(
        ctx,
        { theme: "overworld", decor: window.LEVELS[0].decor },
        fakeCamera,
        this.clock
      );

      // Ground strip
      for (let tx = 0; tx < 17; tx++) {
        ctx.drawImage(window.Art.getTile("overworld", "ground", tx, 13, this.clock), tx * TILE, 208);
        ctx.drawImage(window.Art.getTile("overworld", "ground", tx, 14, this.clock), tx * TILE, 224);
      }

      // Scene: a pipe, some blocks, coins, and a few characters.
      const pipeTop = 11;
      ctx.drawImage(window.Art.getTile("overworld", "pipeTopLeft", 13, pipeTop, this.clock), 208, pipeTop * TILE);
      ctx.drawImage(window.Art.getTile("overworld", "pipeTopRight", 14, pipeTop, this.clock), 224, pipeTop * TILE);
      ctx.drawImage(window.Art.getTile("overworld", "pipeBodyLeft", 13, 12, this.clock), 208, 192);
      ctx.drawImage(window.Art.getTile("overworld", "pipeBodyRight", 14, 12, this.clock), 224, 192);

      ctx.drawImage(window.Art.getTile("overworld", "question", 9, 10, this.clock), 144, 160);
      ctx.drawImage(window.Art.getTile("overworld", "brick", 10, 10, this.clock), 160, 160);
      ctx.drawImage(window.Art.getTile("overworld", "brick", 11, 10, this.clock), 176, 160);

      window.Art.drawCoin(ctx, 194, 138 + Math.round(Math.sin(this.clock / 700) * 2), Math.floor(this.clock / 90) % 6);
      window.Art.drawCoin(ctx, 64, 158, (Math.floor(this.clock / 90) + 4) % 6);

      const marioBob = Math.abs(Math.sin(this.clock / 420)) > 0.75 ? 1 : 0;
      window.Art.drawMario(ctx, {
        x: 86,
        y: 192 + marioBob,
        power: 0,
        pose: marioBob ? "walk2" : "stand",
        facing: 1,
        star: false,
      });
      const goombaX = 118 + Math.sin(this.clock / 1600) * 12;
      window.Art.drawGoomba(ctx, goombaX, 192, Math.floor(this.clock / 160) % 2, false);

      // Tiny cloud sparkle pixels around the logo
      for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI * 2 + this.clock * 0.0002;
        const radius = 58 + (i % 3) * 12;
        const x = 128 + Math.cos(angle) * radius * 1.35;
        const y = 52 + Math.sin(angle) * radius * 0.5;
        const alpha = 0.2 + 0.25 * Math.sin(this.clock * 0.004 + i);
        if (alpha > 0.15) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = i % 2 ? "#ffe37a" : "#ffffff";
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
          ctx.globalAlpha = 1;
        }
      }

      window.Art.drawText(ctx, "TOP- " + pad(this.highScore, 6), 128, 9, {
        align: "center",
        color: "#ffffff",
        shadow: "#173364",
        shadowOffset: 1,
      });

      // Logo
      window.Art.drawText(ctx, "SUPER", 128, 27, {
        scale: 3,
        spacing: 2,
        align: "center",
        color: "#ffdd5c",
        shadow: "#762008",
        shadowOffset: 2,
        outline: true,
      });
      window.Art.drawText(ctx, "MARIO", 128, 49, {
        scale: 5,
        spacing: 1,
        align: "center",
        color: "#fff5d9",
        shadow: "#671b12",
        shadowOffset: 2,
        outline: true,
      });
      window.Art.drawText(ctx, "HTML5 PIXEL TRIBUTE", 128, 91, {
        scale: 1,
        align: "center",
        color: "#fff2cc",
        shadow: "#173364",
        shadowOffset: 1,
      });

      // little gold divider
      ctx.fillStyle = "rgba(255, 224, 120, 0.75)";
      ctx.fillRect(76, 104, 104, 1);
      ctx.fillStyle = "rgba(25, 53, 100, 0.3)";
      ctx.fillRect(76, 105, 104, 1);

      const blink = Math.floor(this.clock / 420) % 2 === 0;
      if (blink) {
        window.Art.drawText(ctx, "PRESS ENTER", 128, 113, {
          scale: 2,
          spacing: 1,
          align: "center",
          color: "#fff8dc",
          shadow: "#4b160c",
          shadowOffset: 1,
          outline: true,
        });
      }
      window.Art.drawText(ctx, "OR TAP THE SCREEN", 128, 132, {
        scale: 1,
        align: "center",
        color: "#fff5d9",
        shadow: "#173364",
        shadowOffset: 1,
      });
      window.Art.drawText(ctx, "ARROWS MOVE   SPACE JUMP   SHIFT RUN", 128, 146, {
        scale: 1,
        align: "center",
        color: "#f7f2dc",
        shadow: "#18366a",
        shadowOffset: 1,
      });

      // Keep the logo area readable even over clouds.
      window.Art.drawText(ctx, "© 2026 FAN TRIBUTE", 128, 231, {
        scale: 1,
        align: "center",
        color: "#f8e6b8",
        shadow: "#3c250d",
        shadowOffset: 1,
      });
    }

    renderIntro() {
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // subtle pixel stars
      for (let i = 0; i < 28; i++) {
        const x = (i * 83 + 17) % 256;
        const y = (i * 59 + 13) % 220;
        const a = 0.08 + ((i * 7) % 10) / 40;
        ctx.globalAlpha = a;
        ctx.fillStyle = "#a8c8ff";
        ctx.fillRect(x, y, 1, 1);
        ctx.globalAlpha = 1;
      }

      const id = this.level ? this.level.data.id : "1-1";
      const name = this.level ? this.level.data.name : "MUSHROOM PLAINS";
      window.Art.drawText(ctx, "WORLD " + id, 128, 72, {
        scale: 2,
        spacing: 1,
        align: "center",
        color: "#fff6d8",
        shadow: "#5d170e",
        shadowOffset: 1,
        outline: true,
      });
      window.Art.drawText(ctx, name, 128, 94, {
        scale: 1,
        align: "center",
        color: "#ffd447",
        shadow: "#241308",
        shadowOffset: 1,
      });

      ctx.fillStyle = "rgba(255, 212, 71, 0.4)";
      ctx.fillRect(72, 108, 112, 1);

      window.Art.drawMario(ctx, {
        x: 105,
        y: 119,
        power: 0,
        pose: "stand",
        facing: 1,
      });
      window.Art.drawText(ctx, "× " + this.lives, 126, 124, {
        scale: 1,
        color: "#ffffff",
        shadow: "#15100e",
        shadowOffset: 1,
      });

      if (Math.floor(this.stateTimer / 16) % 2 === 0) {
        window.Art.drawText(ctx, "GET READY!", 128, 166, {
          scale: 1,
          align: "center",
          color: "#ffd447",
          shadow: "#1b0c06",
          shadowOffset: 1,
        });
      }

      window.Art.drawText(ctx, "TOP- " + pad(this.highScore, 6), 128, 210, {
        scale: 1,
        align: "center",
        color: "#6c7694",
        shadow: "#000000",
        shadowOffset: 1,
      });
    }

    renderGameOver() {
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      for (let i = 0; i < 22; i++) {
        const x = (i * 79 + 11) % 256;
        const y = (i * 47 + 32) % 210;
        ctx.globalAlpha = 0.08 + ((i * 3) % 7) / 35;
        ctx.fillStyle = "#a8b8ff";
        ctx.fillRect(x, y, 1, 1);
        ctx.globalAlpha = 1;
      }

      window.Art.drawText(ctx, "GAME OVER", 128, 80, {
        scale: 3,
        spacing: 1,
        align: "center",
        color: "#fff0df",
        shadow: "#71131d",
        shadowOffset: 2,
        outline: true,
      });
      ctx.fillStyle = "rgba(239, 59, 59, 0.5)";
      ctx.fillRect(74, 107, 108, 1);

      window.Art.drawText(ctx, "SCORE " + pad(this.score, 6), 128, 118, {
        scale: 1,
        align: "center",
        color: "#ffffff",
        shadow: "#000000",
        shadowOffset: 1,
      });
      window.Art.drawText(ctx, "TOP- " + pad(this.highScore, 6), 128, 132, {
        scale: 1,
        align: "center",
        color: "#ffd447",
        shadow: "#000000",
        shadowOffset: 1,
      });

      if (Math.floor(this.stateTimer / 24) % 2 === 0) {
        window.Art.drawText(ctx, "PRESS ENTER TO TRY AGAIN", 128, 166, {
          scale: 1,
          align: "center",
          color: "#ffffff",
          shadow: "#000000",
          shadowOffset: 1,
        });
      }
    }

    renderPauseOverlay() {
      ctx.fillStyle = "rgba(4, 7, 14, 0.76)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      window.Art.drawText(ctx, "PAUSED", 128, 76, {
        scale: 3,
        align: "center",
        color: "#fff5d9",
        shadow: "#59140d",
        shadowOffset: 2,
        outline: true,
      });
      ctx.fillStyle = "rgba(255, 212, 71, 0.5)";
      ctx.fillRect(78, 101, 100, 1);
      if (this.level) {
        window.Art.drawText(ctx, "WORLD " + this.level.data.id + " / " + this.level.data.name, 128, 112, {
          scale: 1,
          align: "center",
          color: "#d7e2f7",
          shadow: "#000000",
          shadowOffset: 1,
        });
      }
      window.Art.drawText(ctx, "SCORE " + pad(this.score, 6) + "   COINS × " + pad(this.coins, 2), 128, 128, {
        scale: 1,
        align: "center",
        color: "#ffffff",
        shadow: "#000000",
        shadowOffset: 1,
      });
      window.Art.drawText(ctx, "LIVES × " + this.lives, 128, 142, {
        scale: 1,
        align: "center",
        color: "#ffd447",
        shadow: "#000000",
        shadowOffset: 1,
      });
      if (Math.floor(this.stateTimer / 20) % 2 === 0) {
        window.Art.drawText(ctx, "PRESS P OR ESC TO RESUME", 128, 166, {
          scale: 1,
          align: "center",
          color: "#ffffff",
          shadow: "#000000",
          shadowOffset: 1,
        });
      }
      window.Art.drawText(ctx, "M SOUND   F FULLSCREEN", 128, 190, {
        scale: 1,
        align: "center",
        color: "#7784a1",
        shadow: "#000000",
        shadowOffset: 1,
      });
    }

    renderClearOverlay() {
      const fade = clamp(this.stateTimer / 30, 0, 1);
      ctx.fillStyle = "rgba(3, 5, 11, " + (0.78 * fade) + ")";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      const id = this.level ? this.level.data.id : "";
      const name = this.level ? this.level.data.name : "";
      window.Art.drawText(ctx, "COURSE CLEAR!", 128, 54, {
        scale: 2,
        spacing: 1,
        align: "center",
        color: "#ffd447",
        shadow: "#6e170e",
        shadowOffset: 2,
        outline: true,
      });
      window.Art.drawText(ctx, "WORLD " + id + " / " + name, 128, 82, {
        scale: 1,
        align: "center",
        color: "#ffffff",
        shadow: "#000000",
        shadowOffset: 1,
      });

      ctx.fillStyle = "rgba(255, 212, 71, 0.4)";
      ctx.fillRect(76, 96, 104, 1);

      const rows = [
        ["TIME BONUS", pad(this.clearBonus, 6)],
        ["SCORE", pad(this.score, 6)],
        ["COINS", "× " + pad(this.coins, 2)],
        ["LIVES", "× " + this.lives],
      ];
      rows.forEach((row, i) => {
        window.Art.drawText(ctx, row[0], 78, 112 + i * 14, {
          scale: 1,
          color: "#aebbd4",
          shadow: "#000000",
          shadowOffset: 1,
        });
        window.Art.drawText(ctx, row[1], 186, 112 + i * 14, {
          scale: 1,
          align: "right",
          color: i === 0 ? "#ffd447" : "#ffffff",
          shadow: "#000000",
          shadowOffset: 1,
        });
      });

      if (this.stateTimer > 105 && Math.floor(this.stateTimer / 24) % 2 === 0) {
        const next = this.levelIndex + 1 >= window.LEVELS.length
          ? "THANK YOU, MARIO!"
          : "NEXT COURSE...";
        window.Art.drawText(ctx, next, 128, 190, {
          scale: 1,
          align: "center",
          color: "#ffffff",
          shadow: "#000000",
          shadowOffset: 1,
        });
      }
    }

    renderWin() {
      const scene = this.winScene;
      const level = this.level || { theme: "night", decor: { clouds: [], hills: [], bushes: [] } };
      window.Art.drawBackground(ctx, level, 0, this.clock);

      // Dim the sky slightly and give the ending text a clean dark band.
      ctx.fillStyle = "rgba(3, 6, 15, 0.16)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "rgba(3, 6, 15, 0.58)";
      ctx.fillRect(0, 0, VIEW_W, 98);
      ctx.fillStyle = "rgba(255, 212, 71, 0.28)";
      ctx.fillRect(34, 101, 188, 1);

      // Ground
      for (let tx = 0; tx < 17; tx++) {
        ctx.drawImage(window.Art.getTile(level.theme, "ground", tx, 13, this.clock), tx * TILE, 208);
        ctx.drawImage(window.Art.getTile(level.theme, "ground", tx, 14, this.clock), tx * TILE, 224);
      }

      window.Art.drawCastle(ctx, level.theme, 88, 208, 1);

      const finalPower = this.player ? this.player.power : 0;
      window.Art.drawMario(ctx, {
        x: 122,
        y: finalPower > 0 ? 176 : 192,
        power: finalPower,
        pose: "stand",
        facing: 1,
        star: false,
      });

      if (scene) {
        for (const firework of scene.fireworks) {
          const progress = 1 - firework.life / firework.maxLife;
          const radius = 4 + progress * 24;
          const count = 12;
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + firework.seed;
            const x = firework.x + Math.cos(angle) * radius;
            const y = firework.y + Math.sin(angle) * radius * 0.75;
            ctx.globalAlpha = clamp(firework.life / 20, 0, 1);
            ctx.fillStyle = i % 3 === 0 ? "#fff8cf" : firework.color;
            ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        for (const confetti of scene.confetti) {
          ctx.globalAlpha = clamp(confetti.life / 25, 0, 1);
          ctx.fillStyle = confetti.color;
          ctx.fillRect(Math.round(confetti.x), Math.round(confetti.y), 2, 2);
          ctx.globalAlpha = 1;
        }
      }

      window.Art.drawText(ctx, "THANK YOU MARIO!", 128, 24, {
        scale: 2,
        spacing: 1,
        align: "center",
        color: "#fff3cc",
        shadow: "#5f170e",
        shadowOffset: 2,
        outline: true,
      });
      window.Art.drawText(ctx, "YOUR QUEST IS OVER", 128, 51, {
        scale: 1,
        align: "center",
        color: "#ffd447",
        shadow: "#000000",
        shadowOffset: 1,
      });
      window.Art.drawText(ctx, "FINAL SCORE  " + pad(this.score, 6), 128, 67, {
        scale: 1,
        align: "center",
        color: "#ffffff",
        shadow: "#000000",
        shadowOffset: 1,
      });
      window.Art.drawText(ctx, "COINS × " + pad(this.coins, 2) + "   LIVES × " + this.lives, 128, 82, {
        scale: 1,
        align: "center",
        color: "#c8d5ef",
        shadow: "#000000",
        shadowOffset: 1,
      });

      ctx.fillStyle = "rgba(3, 5, 11, 0.72)";
      ctx.fillRect(0, 211, VIEW_W, 29);
      ctx.fillStyle = "rgba(255, 212, 71, 0.35)";
      ctx.fillRect(46, 211, 164, 1);
      if (Math.floor(this.stateTimer / 24) % 2 === 0) {
        window.Art.drawText(ctx, "PRESS ENTER TO PLAY AGAIN", 128, 222, {
          scale: 1,
          align: "center",
          color: "#ffffff",
          shadow: "#000000",
          shadowOffset: 1,
        });
      }
    }
  }

  // Runtime input structures shared by keyboard and pointer controls.
  Game.prototype.keyDownSet = new Set();
  Game.prototype.touchState = { left: false, right: false, jump: false, run: false };

  const game = new Game();
  window.__MARIO__ = game;
  window.__startMario = () => game.startNewGame();

  function loop(timestamp) {
    game.frame(timestamp);
  }

  // The game is ready immediately, including on file://.
  window.Art.init();
  requestAnimationFrame(loop);

  // Convenient for automated visual checks and curious players.
  if (game.debugMode) {
    canvas.addEventListener("dblclick", () => {
      if (game.state !== "playing") return;
      game.timeLeft = Math.max(game.timeLeft, 400);
      game.addScore(10000);
    });
  }
})();
