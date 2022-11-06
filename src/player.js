import {Level} from "./level.js";
import Renderer from "./renderer.js";
import Animation from "./animation.js";
import AudioManager from "./audioManager.js";
import * as Network from "./network";
import LevelState from "./levelState.js";

const VELMOVING = 0.125;
const VELTURBOMOVING = 0.171875;
const VELMOVINGADD = 0.015625;
const VELMOVINGFRICTION = 0.00625;
const VELAIRFRICTION = 0.001875;
const VELJUMP = 0.28125;
const VELTURBOJUMP = 0.32875;
const GRAVITY = 0.0125;
const MAXVELY = 0.625;
const PIPESPEED = 0.03;
const PLRWIDTH = 0.6;
const PLRHEIGHT = 1.0;

export class Player {
  constructor(level, pal, gamemode, name) {
    this.name = name;
    this.palette = pal;
    this.respawn(level, null);
    this.direction = 1;
    this.grounded = false;
    this.skidding = 0;
    this.death_timer = 0;
    this.pipe_dist = -32;
    this.pipe_state = 0;
    this.pipe_x = 0;
    this.pipe_y = 0;
    this.pipe_cooldown = 0;
    this.cyote = 0;
    this.squashed = false;
    this.kills = gamemode == 3 ? 10 : 0;
    this.fire = false;
    this.fireballs = [];
    this.chicken = false;
    this.bombomb = false;
    this.exploded = 0;
    this.racoon = false;
    this.racoonJumps = 2;
    this.inputs = {
      left: false,
      right: false,
      up: false,
      down: false,
      run: false,
      jump: false,
      fireball: false,
    };

    this.animation = new Animation(
      [0, 1, 10],
      [0, 3, 4],
      [3, 1, 10],
      [5, 1, 10],
      [0, 3, 2],
      [4, 1, 10],
      [7, 1, 10]
    );
  }

  update_inputs(l, r, u, d, run, jump, fireball) {
    this.inputs = {
      left: l,
      right: r,
      up: u,
      down: d,
      run: run,
      jump: jump,
      fireball: fireball
    };
  }

  update(/** @type {Level} */ l, /** @type {AudioManager} */ am, playerList, myIdx,
      lobby, gamemode, frame, /** @type {LevelState} */ lvlState) {
    if (this.exploded > 0) {
      if (this.exploded > 1) this.exploded--;
      this.death_timer = 1000;
      return;
    }
    else if (this.death_timer > 0) {
      if (!this.squashed) {
        this.vy -= GRAVITY;
        this.y += this.vy;
      }
      if (--this.death_timer == 0) {
        this.respawn(l, playerList);
      }
    }
    else if (this.pipe_state == 1) {
      this.pipe_dist -= PIPESPEED;
      this.y -= PIPESPEED;
      if (this.pipe_dist < -1.5) {
        this.pipe_state = 2;
        this.x = this.pipe_x;
        this.y = this.pipe_y + this.pipe_dist;
        am.play("snd_pipe", false);
      }
    }
    else if (this.pipe_state == 2) {
      this.pipe_dist += PIPESPEED;
      this.y += PIPESPEED;
      if (!l.is_colliding(this.x, this.y, PLRWIDTH, PLRHEIGHT)) {
        this.pipe_state = 0;
        this.vx = 0;
        this.vy = 0;
        this.skidding = 0;
        this.pipe_cooldown = 30;
      }
    }
    else {
      if (frame % 6 == 0 && this.chicken) this.kills++;
      if (frame % 6 == 0 && gamemode == 2 && !this.bombomb) this.kills++;
      this.move(am);
      this.bounds_and_death(l, am);
      this.collide_with_players(am, playerList, myIdx, lobby, gamemode, lvlState);
      this.fireflower(l, am, myIdx, lobby);
      this.process_physics(l, am, myIdx, lobby, gamemode);
    }

    this.process_fireballs(l, am, myIdx, lobby, playerList, gamemode, lvlState);
    this.process_animations();
  }

  die(am) {
    if (this.death_timer <= 0) {
      am.play("snd_death", false);
      this.death_timer = 40;
      this.squashed = false;
      this.vy = VELJUMP;
      this.vx = 0;
    }
  }

  squash(am) {
    if (this.death_timer <= 0) {
      am.play("snd_death", false);
      this.death_timer = 40;
      this.squashed = true;
      this.vy = 0;
      this.vx = 0;
    }
  }

  respawn(/** @type {Level} */ l, playerList) {
    this.fire = false;
    this.chicken = false;
    this.racoon = false;
    let i = Math.min(l.spawns.length - 1, this.palette);
    this.x = l.spawns[i].x;
    this.y = l.spawns[i].y;
    if (playerList != null) {
      let spawns = [...Array(l.spawns.length).keys()];
      for (let j = spawns.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [spawns[j], spawns[k]] = [spawns[k], spawns[j]];
      }
      for (let j = 0; j < spawns.length; j++) {
        this.x = l.spawns[spawns[j]].x;
        this.y = l.spawns[spawns[j]].y;
        playerList.forEach(player => {
          if (!playersCollide(this, player)) j = spawns.length + 1;
        });
      }
    }
    this.vx = 0;
    this.vy = 0;
  }

  move(am) {
    let dir = this.inputs.right - this.inputs.left;
    let maxVel = this.inputs.run ? VELTURBOMOVING : VELMOVING;
    if (this.chicken) maxVel /= 1.4;
    this.vx += VELMOVINGADD * dir;
    if (Math.sign(this.vx) == dir && Math.abs(this.vx) > maxVel)
      this.vx = maxVel * dir;

    if (dir == 0) {
      let dec = this.grounded ? VELMOVINGFRICTION : VELAIRFRICTION;
      if (Math.abs(this.vx) > dec) this.vx -= dec * Math.sign(this.vx);
      else this.vx = 0;
    }
    else {
      this.direction = dir;
      if (this.grounded && Math.sign(this.vx) != dir) {
        this.skidding = dir;
        am.play("snd_skid", false);
      }
    }

    if ((dir != 0 && this.skidding != dir) || Math.abs(this.vx) <= 0.01 || this.skidding == Math.sign(this.velx))
        this.skidding = 0;

    if (this.inputs.jump && (this.grounded || this.cyote > 0)) {
      if (Math.abs(this.vx) > VELMOVING) this.vy = VELTURBOJUMP;
      else this.vy = VELJUMP;
      this.cyote = 0;
      am.play("snd_jump", false);
    }
    else if (this.racoon && this.inputs.jump && this.racoonJumps > 0) {
      if (this.racoonJumps == 2) this.vy = VELJUMP * 0.8;
      if (this.racoonJumps == 1) this.vy = VELJUMP * 0.2;
      this.racoonJumps--;
    }
    if (this.racoon) {
      if (this.inputs.up) {
        this.vy -= GRAVITY / 2;
        if (this.vy < -MAXVELY / 4) this.vy = -MAXVELY / 4;
      }
      else this.vy -= GRAVITY * 1.2;
      if (this.grounded) this.racoonJumps = 2;
    }
    else {
      this.vy -= GRAVITY;
    }
    if (this.vy < -MAXVELY) this.vy = -MAXVELY;
    if (this.grounded && this.vy < 0.05) this.cyote = 8;
    else if (!this.grounded && this.cyote > 0) this.cyote--;
  }

  bounds_and_death(/** @type {Level} */ l, am) {
    if (l.props[l.get_tile(this.x, this.y)].damaging || this.y < 0) {
      this.die(am);
      return;
    }
    if (this.x - (PLRWIDTH/2 + 0.1) < 0) {
      this.x = (PLRWIDTH/2 + 0.1);
      this.vx = 0;
    }
    if (this.x + (PLRWIDTH/2 + 0.1) > l.width) {
      this.x = l.width - (PLRWIDTH/2 + 0.1);
      this.vx = 0;
    }
    if (this.pipe_cooldown > 0) this.pipe_cooldown--;
    if (this.inputs.down && this.pipe_state == 0 && this.pipe_cooldown <= 0) {
      let pipe_id = l.get_pipe_id(this.x, this.y - PLRHEIGHT / 2 - 0.2);
      let [x, y] = l.get_connected_pipe(pipe_id);
      if (x >= 0 && y >= 0 && pipe_id != -1) {
        am.play("snd_pipe", false);
        this.pipe_dist = 0;
        this.pipe_state = 1;
        this.x = l.pipes[pipe_id][0] + 1.0;
        this.pipe_x = x + 1.0;
        this.pipe_y = y + PLRHEIGHT / 2;
      }
    }
    if (this.vy <= GRAVITY && l.get_tile(this.x, this.y - PLRHEIGHT / 2 - 0.1) == l.specialTiles.invisibleSolid) {
      this.vy = VELJUMP / 6;
    }
  }

  collide_with_players(am, playerList, myIdx, /** @type {Network.Lobby} */ lobby, gamemode, /** @type {LevelState} */ lvlState) {
    // Collide with players (next we'll collide with coins)
    playerList.forEach((player, idx) => {
      if (idx == myIdx) return;

      // Are we the local player? And can we squash them?
      if (canSquashPlayer(this, player) && lobby.playerIdx == myIdx &&
        player.death_timer <= 0 && player.pipe_state == 0) {
        // Pass the bomb off if we are in the bombomb gamemode
        if (gamemode == 2 && this.bombomb) {
          lobby.send("bombPass", idx);
          am.play("snd_pass", false);
          this.bombomb = false;
        }
        else if (gamemode != 2) {
          lobby.send("sq", idx);
          this.tryToBecomeChicken(idx, playerList, gamemode, am, lobby);
          am.play("snd_hit", false);
          if (lvlState.isHost && gamemode == 3) lvlState.spawnCoins(idx);

          this.vy = VELJUMP * 0.9;
          if (gamemode != 3) this.kills++;
        }

        if (this.racoon) this.racoonJumps = 2;
      }
      // Works both ways
      if (playersCollide(this, player)) {
        let pushDir = Math.sign(this.x - player.x);
        if (Math.sign(this.vx) != pushDir) {
          this.vx = VELTURBOMOVING * pushDir;
          am.play("snd_bump", false);
        }
        else this.vx += pushDir * VELMOVINGADD;
      }
    });

    // Collide with coins
    for (const [uuid, obj] of Object.entries(lvlState.lvlObjects)) {
      if (isColliding(this, obj.x, obj.y, obj.size, obj.size) && obj.type === "c" && obj.iframes <= 0 && lobby.playerIdx == myIdx) {
        if (lvlState.isHost) {
          this.kills++;
          obj.playCollectAnim();
          am.play("snd_coin", false);
        }
        else lobby.sendUnreliable("cc", {
          plr: lobby.playerIdx,
          id: uuid
        });
      }
    }
  }

  process_animations() {
    if (this.death_timer > 0 && this.squashed) this.animation.set_anim(6);
    else if (this.death_timer > 0) this.animation.set_anim(5);
    else if (this.pipe_state != 0) this.animation.set_anim(0);
    else if (!this.grounded) this.animation.set_anim(2);
    else if (this.skidding != 0) this.animation.set_anim(3);
    else if (Math.abs(this.vx) > VELMOVING) this.animation.set_anim(4);
    else if (Math.abs(this.vx) > 0.01) this.animation.set_anim(1);
    else this.animation.set_anim(0);
    this.animation.step();
  }

  process_physics(/** @type {Level} */ l, am, myIdx, lobby, gamemode) {
    let oldvy = this.vy;
    
    let [x, y, vx, vy] = l.process_physics(this.x, this.y-0.1, this.vx, this.vy, PLRWIDTH, PLRHEIGHT-0.2);
    this.x = x;
    this.y = y+0.1;
    this.vx = vx;
    this.vy = vy;

    this.grounded = l.is_colliding(this.x, this.y - 0.3, PLRWIDTH, PLRHEIGHT);

    // Bump tiles
    if (l.is_colliding(this.x, this.y + 0.1, PLRWIDTH, PLRHEIGHT) && oldvy > 0 && this.vy <= 0) {
      l.bump_tile(am, this.x, this.y + 0.1 + PLRHEIGHT / 2, lobby, myIdx == lobby.playerIdx, this, gamemode);
      l.bump_tile(am, this.x - PLRWIDTH / 2, this.y + 0.1 + PLRHEIGHT / 2, lobby, myIdx == lobby.playerIdx, this, gamemode);
      l.bump_tile(am, this.x + PLRWIDTH / 2, this.y + 0.1 + PLRHEIGHT / 2, lobby, myIdx == lobby.playerIdx, this, gamemode);
      am.play("snd_bump", false);
    }
  }

  fireflower(/** @type {Level} */ l, am, myIdx, lobby) {
    // If we are the chicken we can't be fire mario
    if (this.chicken) {
      this.fire = false;
      this.racoon = false;
      return;
    }

    // Get fire flowers
    if (myIdx == lobby.playerIdx && l.get_tile(this.x, this.y) == l.specialTiles.fireflower && !this.fire) {
      this.fire = true;
      this.racoon = false;
      lobby.send("set_tile", {x: this.x, y: this.y, id: 0});
      am.play("snd_powerup", false);
      l.set_tile(this.x, this.y, 0);
    }

    // Get racoon leafs
    if (myIdx == lobby.playerIdx && l.get_tile(this.x, this.y) == l.specialTiles.leaf && !this.leaf) {
      this.racoon = true;
      this.fire = false;
      lobby.send("set_tile", {x: this.x, y: this.y, id: 0});
      am.play("snd_powerup", false);
      l.set_tile(this.x, this.y, 0);
    }

    if (!this.fire) return; // All next things are only for fireball users

    // Throw fireballs
    if (myIdx == lobby.playerIdx && this.inputs.fireball && this.fireballs.length < 3) {
      this.fireballs.push({
        x: this.x + this.direction * 0.4,
        y: this.y,
        vx: this.vx + this.direction * VELMOVING,
        vy: 0,
        state: 0,
      });
      am.play("snd_fireball", false);
    }
  }

  process_fireballs(/** @type {Level} */ l, am, myIdx, lobby, playerList, gamemode, /** @type {LevelState} */ lvlState) {
    // Process fire flowers
    this.fireballs.forEach((fb, fbidx) => {
      if (fb.state > 0) {
        if (fb.state++ > 9) this.fireballs.splice(fbidx, 1);
        return;
      }

      fb.vy -= GRAVITY;
      if (Math.abs(fb.vx) < VELTURBOMOVING) fb.vx += Math.sign(fb.vx) * VELMOVINGADD;
      let [fx, fy, fvx, fvy] = l.process_physics(fb.x, fb.y, fb.vx, fb.vy, 0.4, 0.4);
      fb.x = fx;
      fb.y = fy;
      fb.vx = fvx;
      fb.vy = fvy;

      if (l.is_colliding(fb.x, fb.y - 0.1, 0.4, 0.4))
        fb.vy = VELJUMP / 2.25;
      if (l.is_colliding(fb.x, fb.y, 0.6, 0.4) || fb.y < -1 || fb.x < -1 || fb.x > l.width + 0.5)
        fb.state = 1;

      playerList.forEach((plr, idx) => {
        if (idx != myIdx && plr.death_timer <= 0 && fireballCollidesWithPlayer(fb.x, fb.y, 0.4, 0.4, plr)) {
          if (myIdx == lobby.playerIdx) {
            lobby.send("die", idx);
            this.tryToBecomeChicken(idx, playerList, gamemode, am, lobby);
          }
          am.play("snd_bump", false);
          if (lvlState.isHost && gamemode == 3 && lobby.playerIdx == myIdx) {
            lvlState.spawnCoins(idx);
            plr.kills = 0;
          }
          if (gamemode != 3) this.kills++;
          fb.state = 1;
        }
      });
    });
  }

  tryToBecomeChicken(idx, playerList, gamemode, am, /** @type {Network.Lobby} */ lobby) {
    if (gamemode != 1) return;
    if (this.chicken) {
      am.play("snd_chicken", false);
      lobby.sendUnreliable("snd_chicken", {sourceIdx: lobby.playerIdx});
    }

    // Check if anybodies chicken right now
    let chickenIdx = -1;
    playerList.forEach((player, i) => {
      if (player.chicken) chickenIdx = i;
    });
    if (chickenIdx == idx || chickenIdx == -1) {
      // We can become chicken
      this.chicken = true;
      this.fire = false;
    }
  }

  draw(/** @type {Renderer} */ r, name, gfxframe, isWinner, /** @type {Level} */lvl) {
    if (this.exploded > 0) {
      if (this.exploded > 1) {
        r.draw("tex_explosion", this.x, this.y, 0, 0, 4.5, 3, Math.floor(this.exploded / 10) % 2);
        r.draw("tex_light_yellow", this.x, this.y, 0.0, 0.0, 10, 7, Math.floor(Math.random() * 4));
      }
      return;
    }

    // Draw helper pointer arrow
    if (this.y > lvl.height) {
      r.draw("tex_pointer", this.x, lvl.height - 0.6, 0, 0, 1, 1, 0);
    }

    let z = 0;
    if (this.pipe_state != 0) z = -10;
    if (!this.chicken)
      r.draw_paletted("tex_player_small", this.x, this.y, z, 0, this.direction, 1, this.animation.get_frame(), this.palette + (this.fire ? 8 : 0));
    else
      r.draw("tex_player_chicken", this.x, this.y, z, 0, this.direction, 1, this.animation.get_frame());
    if (this.bombomb)
      r.draw("tex_bombomb", this.x + this.direction*0.4, this.y+0.1, 0, 0, this.direction, 1, 0);
    
    if (this.fire)
      r.draw("tex_light_yellow", this.x, this.y, 0.0, 0.0, 2.0, 2.0, Math.floor(Math.random() * 4));

    // Draw the racoon tail
    if (this.racoon) {
      let racx = this.x - this.direction * 0.3;
      if (this.animation.anim == 2) {// Draw flying tail
        let frame = 0;
        if (this.inputs.up) {
          let speed = 4;
          if (this.vy > 0.05) speed = 5;
          else if (this.vy > -0.08) speed = 6;
          else speed = 7;
          frame = Math.floor(gfxframe / speed) % 4 + 3;
        }
        else {
          if (this.vy > 0.02) frame = 5;
          else if (this.vy > -0.11) frame = 4;
          else frame = 3;
        }
        r.draw("tex_tail", racx, this.y, z - 0.1, 0, -this.direction, 1, frame);
      }
      else if (Math.abs(this.vx) < 0.07)
        r.draw("tex_tail", racx, this.y-0.1, z-0.1, 0, -this.direction, 1, 0);
      else if (Math.abs(this.vx) < VELMOVING-0.001)
        r.draw("tex_tail", racx, this.y-0.1, z-0.1, 0, -this.direction, 1, 1);
      else
        r.draw("tex_tail", racx, this.y-0.1, z-0.1, 0, -this.direction, 1, 2);
    }

    r.draw_text(this.x, this.y + 1, 0, 0.2, true, isWinner ? name + " wins!" : name);

    this.fireballs.forEach(fireball => {
      let dir = Math.sign(fireball.vx);
      let lightSize = (fireball.state == 0) ? 3.0 : 5.0;
      if (fireball.state == 0)
        r.draw("tex_fireball", fireball.x, fireball.y, 0, gfxframe / 2 * -dir, 0.4*dir, 0.4, 0);
      else
        r.draw("tex_fireball_impact", fireball.x, fireball.y, 0, 0, 0.7, 0.7, 0);
      r.draw("tex_light_yellow", fireball.x, fireball.y, 0.0, 0.0, lightSize, lightSize, Math.floor(Math.random() * 4));
    });
  }
}

export function playerFromJSON(json) {
  Object.setPrototypeOf(json, Player.prototype);
  Object.setPrototypeOf(json.animation, Animation.prototype);
  return json;
}

function playersCollide(/** @type {Player} */ p1, /** @type {Player} */ p2) {
  if (p1.x + PLRWIDTH / 2 > p2.x - PLRWIDTH / 2 && 
      p2.x + PLRWIDTH / 2 > p1.x - PLRWIDTH / 2 &&
      p1.y + PLRHEIGHT / 2 > p2.y - PLRHEIGHT / 2 && 
      p2.y + PLRHEIGHT / 2 > p1.y - PLRHEIGHT / 2 &&
      p2.exploded <= 0 && p2.death_timer <= 0 && p2.pipe_state == 0) {
    return true;
  }
  return false;
}

function fireballCollidesWithPlayer(x, y, w, h, /** @type {Player} */ p2) {
  if (x + w / 2            > p2.x - PLRWIDTH / 2 && 
      p2.x + PLRWIDTH / 2  > x - w / 2 &&
      y + h / 2            > p2.y - PLRHEIGHT / 2 && 
      p2.y + PLRHEIGHT / 2 > y - h / 2 &&
      p2.exploded <= 0 && p2.death_timer <= 0 && p2.pipe_state == 0) {
    return true;
  }
  return false;
}

function canSquashPlayer(/** @type {Player} */ p1, /** @type {Player} */ p2) {
  let newHeight = PLRHEIGHT + 0.5;
  if (p1.x + PLRWIDTH / 2 > p2.x - PLRWIDTH / 2 && 
      p2.x + PLRWIDTH / 2 > p1.x - PLRWIDTH / 2 &&
      p1.y + newHeight / 2 > p2.y - PLRHEIGHT / 2 && 
      p2.y + PLRHEIGHT / 2 > p1.y - newHeight / 2 &&
      p1.y > p2.y + 0.5 &&
      p2.exploded <= 0 && p2.death_timer <= 0 && p2.pipe_state == 0) {
    return true;
  }
  return false;
}

function isColliding(/** @type {Player} */ p1, x, y, w, h) {
  if (p1.x + PLRWIDTH / 2  > x - w / 2 && 
      x + w / 2            > p1.x - PLRWIDTH / 2 &&
      p1.y + PLRHEIGHT / 2 > y - h / 2 && 
      y + h / 2            > p1.y - PLRHEIGHT / 2) {
    return true;
  }
  return false;
}
