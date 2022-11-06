import Renderer from "./renderer.js";
import AudioManager from "./audioManager.js";
import * as Network from "./network";
import { Player } from "./player.js";
import Cookies from "js-cookie";

export class Level {
  constructor() {
    // Get the tile properties
    let json = get_json("lvl_tiles");
    this.levelid = -1;
    this.props = [];

    // Special tiles (hard coded)
    this.specialTiles = {
      qblock: 49,
      player: 45,
      invisibleSolid: 64,
      fireflower: 56,
      pipe: 46,
      brick0: 5,
      brick1: 62,
      brick2: 63,
      usedQblock: 53,
      leaf: 72
    };

    // Create the air tile
    this.props[0] = {};
    this.props[0].animated = false;
    this.props[0].solid = false;
    this.props[0].damaging = false;
    this.props[0].lightType = "";

    json.tiles.forEach(tile => {
      let id = tile.id + 1;
      this.props[id] = {};

      // Default values
      this.props[id].animated = false;
      this.props[id].solid = false;
      this.props[id].damaging = false;
      this.props[id].lightType = "";
      
      tile.properties.forEach(prop => {
        this.props[id][prop.name] = prop.value;
      });
    });
  }

  createNew(audio, overwriteSettings, width, height) {
    this.levelid = -1;
    this.bumped_tiles = [];
    this.qBlockLocs = [];
    if (overwriteSettings) {
      this.background = 4;
      this.music = 5;
      this.title = "Untitled";
    }
    audio.play_music("mus" + this.music.toString());
    this.width = width;
    this.height = height;
    this.tiles = [];
    for (let i = 0; i < this.width*this.height; i++) {
      this.tiles.push(new Tile(0));
    }
    this.pipes = [];
    this.spawns = [];
  }

  saveToCookie(musicid) {
    let tempTiles = this.tiles.map(tile => { return tile.id; });
    this.spawns.forEach(spawn => {
      tempTiles.push(Math.floor(spawn.x));
      tempTiles.push(Math.ceil(spawn.y));
    });

    let data = {
      w: this.width,
      h: this.height,
      b: this.background,
      m: musicid,
      t: tempTiles,
    };

    Cookies.set("lvl", JSON.stringify(data), { expires: 500, path: "" });
  }

  load(levelid, /** @type {AudioManager} */audio) {
    if (levelid == -1) {
      if (hasLevelCookie())
        this.loadFromCustomFormat(Cookies.get("lvl"), audio);
      else
        this.createNew(audio, true, 32, 24);
    }
    else this._load_tiled(levelid, audio);
  }

  loadFromCustomFormat(str, /** @type {AudioManager} */audio) {
    let json = JSON.parse(str);

    this.levelid = -1;
    this.background = json.b;
    this.music = json.m;
    this.bumped_tiles = [];
    this.qBlockLocs = [];
    this.width = json.w;
    this.height = json.h;
    audio.play_music("mus" + this.music);

    this.tiles = [];
    this.pipes = [];
    for (let i = 0; i < this.width*this.height; i++) {
      let t = json.t[i];
      let tx = Math.floor(i % this.width);
      let ty = Math.floor(i / this.width);

      let newTile = new Tile(t);
      if (t === this.specialTiles.qblock) {
        newTile.qblock = true;
        this.qBlockLocs.push([tx, ty]);
      }
      if (t === this.specialTiles.pipe) this.pipes.push([tx, ty]);
      this.tiles[ty * this.width + tx] = newTile;
    }

    this.spawns = [];
    for (let i = this.width*this.height; i < json.t.length; i += 2) {
      this.spawns.push(new PlayerSpawn(json.t[i]+0.5, json.t[i+1]-0.3));
    }
    if (this.spawns.length <= 0) {
      this.spawns.push(new PlayerSpawn(this.width / 2, this.height / 2));
    }
  }

  _load_tiled(levelid, /** @type {AudioManager} */audio) {
    this.levelid = levelid;
    let json = get_json("lvl"+levelid);

    json.properties.forEach(prop => {
      this[prop.name] = prop.value;
    });

    audio.play_music("mus" + this.music);

    this.bumped_tiles = [];
    this.qBlockLocs = [];

    json.layers.forEach(layer => {
      if (layer.name === "tiles") {
        this.tiles = [];
        this.pipes = [];
        this.width = layer.width;
        this.height = layer.height;

        layer.data.forEach((tile, idx) => {
          let tx = Math.floor(idx % this.width);
          let ty = this.height - Math.floor(idx / this.width) - 1.0;

          let newTile = new Tile(tile);
          if (tile === this.specialTiles.qblock) {
            newTile.qblock = true;
            this.qBlockLocs.push([tx, ty]);
          }
          if (tile === this.specialTiles.pipe) this.pipes.push([tx, ty]);
          this.tiles[ty * this.width + tx] = newTile;
        });
      }
      else if (layer.name === "objects") {
        this.spawns = [];
        this.width = layer.width;
        this.height = layer.height;

        layer.data.forEach((tile, idx) => {
          let tx = Math.floor(idx % this.width) + 0.5;
          let ty = this.height - Math.floor(idx / this.width) - 0.3;

          // Add a player spawn
          if (tile === this.specialTiles.player) {
            this.spawns.push(new PlayerSpawn(tx, ty));
          }
        });
      }
    });
  }

  get_tile(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width)
      return 0;
    if (y >= this.height)
      return this.tiles[(this.height - 1) * this.width + x].id;
    return this.tiles[y * this.width + x].id;
  }

  set_tile(x, y, id) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.width && y < this.height)
      this.tiles[y * this.width + x].id = id;
  }

  get_pipe_id(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    let i = -1;
    this.pipes.forEach((pipeCoord, idx) => {
      if (pipeCoord[1] == y && (pipeCoord[0] == x || pipeCoord[0] + 1 == x)) i = idx;
    });

    return i;
  }

  get_connected_pipe(pipe_id) {
    if (pipe_id === -1) return [-100, -100];
    let i = (pipe_id % 2 == 0) ? 1 : -1;
    pipe_id = (pipe_id + i) % this.pipes.length;
    if (pipe_id < 0) pipe_id = this.pipes.length+pipe_id;
    return this.pipes[pipe_id];
  }

  is_solid(id) {
    return this.props[id].solid;
  }

  is_colliding(x, y, w, h) {
    x -= w / 2;
    y -= h / 2;
    for (let v = y; v < y + h + 1; v++) {
      for (let u = x; u < x + w + 1; u++) {
        if (!this.is_solid(this.get_tile(u, v))) continue;
        if (x < Math.ceil(u) && y < Math.ceil(v) &&
            x + w > Math.floor(u) && y + h > Math.floor(v)) {
          return true;
        }
      }
    }
    return false;
  }

  is_point_colliding(x, y) {
    return this.is_solid(this.get_tile(Math.floor(x), Math.floor(y)));
  }

  process_physics(x, y, vx, vy, w, h) {
    let [cx, cy] = [0, 0];
    if (this.is_colliding(x+vx, y, w, h) && vx != 0) {
      x = Math.round(x + vx) - Math.sign(vx)*(w/2 + 0.03);
      while (this.is_colliding(x, y, w, h)) {
        x -= Math.sign(vx);
      }
      cx = Math.sign(vx) * 0.02;
      vx = 0;
    }
    x += vx;

    if (this.is_colliding(x, y+vy, w, h) && vy != 0) {
      y = Math.round(y + vy) - Math.sign(vy)*(h/2 + 0.03);
      while (this.is_colliding(x, y, w, h)) {
        y -= Math.sign(vy);
      }
      cy = Math.sign(vy) * 0.02;
      vy = 0;
    }
    y += vy;

    x += cx;
    y += cy;

    return [x, y, vx, vy];
  }

  spawn_coin_effect(/** @type {AudioManager} */ am, x, y) {
    this.bumped_tiles.push(new BumpedTile(am, x, y, -1, -1, this, true));
  }

  bump_tile(/** @type {AudioManager} */ am, x, y, /** @type {Network.Lobby} */ lobby, authority, player, gamemode) {
    x = Math.floor(x);
    y = Math.floor(y);
    let tile = this.get_tile(x, y);
    if (tile == this.specialTiles.brick0 ||
      tile == this.specialTiles.brick1 ||
      tile == this.specialTiles.brick2) {
      this.bumped_tiles.push(new BumpedTile(am, x, y, tile, tile, this, false));
      return true;
    }
    if (tile == this.specialTiles.qblock && authority) {
      this.bumped_tiles.push(new BumpedTile(am, x, y, tile, this.specialTiles.usedQblock, this, false));
      setTimeout(() => {
        lobby.send("set_tile", {x: x, y: y, id: this.specialTiles.usedQblock});
      }, 200); // Give the bumped block a little time to come back down.
      if (Math.random() <= 0.25) {
        if (Math.random() <= 0.4) {
          this.set_tile(x, y + 1, this.specialTiles.fireflower);
          lobby.send("set_tile", {x: x, y: y+1, id: this.specialTiles.fireflower});
        }
        else {
          this.set_tile(x, y + 1, this.specialTiles.leaf);
          lobby.send("set_tile", {x: x, y: y+1, id: this.specialTiles.leaf});
        }
      }
      else {
        lobby.sendUnreliable("ce", {x: x, y: y, plr: lobby.playerIdx}); // bumped [C]oin [E]ffect
        this.bumped_tiles.push(new BumpedTile(am, x, y, -1, -1, this, true));
        if (gamemode == 3) player.kills++;
      }
      return true;
    }
    if (tile == this.specialTiles.qblock && !authority) {
      this.bumped_tiles.push(new BumpedTile(am, x, y, tile, this.specialTiles.usedQblock, this, false));
    }
    return false;
  }

  respawn_qblocks(/** @type {Network.Lobby} */lobby) {
    if (this.qBlockLocs.length == 0) return;
    let id = Math.floor(Math.random() * this.qBlockLocs.length);
    let x = this.qBlockLocs[id][0];
    let y = this.qBlockLocs[id][1];
    this.set_tile(x, y, this.specialTiles.qblock);
    lobby.send("set_tile", {x: x, y: y, id: this.specialTiles.qblock});
  }

  draw(/** @type {Renderer} */r, f) {
    this.tiles.forEach((tile, i) => {
      let x = Math.floor(i % this.width);
      let y = Math.floor(i / this.width);
      let id = tile.id - 1;
      let props = this.props[tile.id];
      if (props.animated)
        id += Math.floor((f / 15) % 4);

      if (tile.id && tile.shown) {
        r.draw("tex_terrain", x + 0.5, y + 0.5, -0.5, 0, 1, 1, id);

        props = this.props[id + 1];
        if (props.lightType.length > 0) {
          let tex = "tex_light";
          if (props.lightType.slice(0, 1) == "y") tex += "_yellow";
          if (props.lightType.slice(0, 1) == "l") tex += "_lava";
          let size = Number(props.lightType.slice(1));
          r.draw(tex, x + 0.5, y + 0.5, 0.0, 0, size, size, Math.floor(Math.random() * 4));
        }
      }
    });

    this.bumped_tiles.forEach(tile => {
      tile.step_anim(r);
    });
    while (this.bumped_tiles.length > 0 && this.bumped_tiles[0].dead()) {
      this.bumped_tiles.shift();
    }

    let camsize = r.camera.size()*r.camera.scale*2;
    let camsizex = r.camera.w*r.camera.scale*2;
    let camsizey = r.camera.h*r.camera.scale*2;

    if (r.camera.x < camsizex/2) r.camera.x = camsizex/2;
    if (r.camera.y < camsizey/2) r.camera.y = camsizey/2;
    if (r.camera.x > this.width - camsizex/2) r.camera.x = this.width - camsizex/2;
    if (r.camera.y > this.height - camsizey/2) r.camera.y = this.height - camsizey/2;

    let x_percent = (1.0 - (r.camera.x-camsizex/2) / (this.width-camsizex)) - 0.5;
    let y_percent = (1.0 - (r.camera.y-camsizey/2) / (this.height-camsizey)) - 0.5;
    const scale = 0.5;
    if (this.width < 32) x_percent = 0;
    if (this.height < 24) y_percent = 0;
    x_percent *= scale;
    y_percent *= scale;

    let bgx = r.camera.x + (x_percent * camsize);
    let bgy = r.camera.y + (y_percent * camsize);
    camsize *= 2;

    r.draw("tex_bg" + this.background, bgx, bgy, -50, 0, camsize, camsize, 0);
  }
}

export function hasLevelCookie() {
  try {
    let cookie = Cookies.get("lvl");
    if (cookie.length <= 0) throw "No level";
    JSON.parse(cookie);
    return true;
  }
  catch {
    return false;
  }
}

class BumpedTile {
  constructor(am, x, y, id, newId, level, isCoin) {
    this.am = am;
    this.id = id;
    this.x = x;
    this.y = y;
    this.start_y = y;
    this.newId = newId;
    this.died = false;
    this.level = level;
    this.isCoin = isCoin;
    this.frame = 0;
    this.vy = this.isCoin ? 0.2 : 0.1;
    if (!this.isCoin)
      level.set_tile(this.x, this.y, level.specialTiles.invisibleSolid);
  }

  step_anim(r) {
    if (this.died) return;
    if (this.isCoin) {
      this.vy -= 0.009;
      this.y += this.vy;

      let lastFrame = Math.floor(this.frame);
      this.frame += 1.0 / 5.0;

      if (lastFrame != Math.floor(this.frame) && lastFrame == 1) this.am.play("snd_coin", false);

      if (this.frame >= 9) this.died = true;
      r.draw("tex_coin", this.x + 0.5, this.y + 0.5, -0.5, 0, 1, 1, Math.floor(this.frame));
      r.draw("tex_light_yellow", this.x + 0.5, this.y + 0.5, 0.0, 0.0, 4.0, 4.0, Math.floor(Math.random() * 4));
    }
    else {
      this.vy -= 0.02;
      this.y += this.vy;
      if (this.y <= this.start_y && this.vy < 0) {
        this.died = true;
        this.level.set_tile(this.x, this.start_y, this.newId);
      }
      r.draw("tex_terrain", this.x + 0.5, this.y + 0.5, -0.5, 0, 1, 1, this.id - 1);
    }
  }

  dead() {
    return this.died;
  }
}

export class Tile {
  constructor(id) {
    this.id = id;
    this.fireflower = false;
    this.qblock = false;
    this.shown = true;
  }
}

export class PlayerSpawn {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

function get_json(elem_id) {
  let str = document.getElementById(elem_id).contentDocument.body.children[0].innerHTML;
  return JSON.parse(str);
}
