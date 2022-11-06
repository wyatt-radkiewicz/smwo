import * as Input from "./inputHandler.js";
import MenuStack from "./menuStack.js";
import TitleState from "./titleState";
import { Level, PlayerSpawn } from "./level.js";

export default class LevelEditorState {
  constructor(game) {
    this.game = game;
    this.menuMode = "edit";
    this.level = new Level();
    this.level.load(-1, this.game.audio);
    this.pickCooldown = 10;
    this.menu = new MenuStack(
      this.game.renderer, this.game.audio,
      "settings", () => { this.menuMode = "settings"; },
      "pick block", () => { this.pickCooldown = 10; this.menuMode = "block"; },
    );
    this.menu.verticallyCentered = false;
    this.settingsMenu = new MenuStack(
      this.game.renderer, this.game.audio,
      "back", () => { 
        this.pickCooldown = 10;
        this.menuMode = "edit";
      },
      "background", null,
      "music", null,
      "save and quit", () => {
        // Save the file
        this.level.spawns = [];
        this.spawns.forEach((spawn, i) => {
          if (spawn) {
            this.level.spawns.push(
              new PlayerSpawn(
                Math.floor(i % this.level.width),
                Math.floor(i / this.level.width)
              )
            );
          }
        });
        this.level.saveToCookie(this.settingsMenu.items[2].current);

        this.game.currentState = new TitleState(this.game);
        this.menuMode = "edit";
      },
      "", null,
      "", null,
      "", null,
      "", null,
      "shape (clears blocks)", null,
    );

    this.settingsMenu.items[1].options = [
      "Sky", "Water", "Underground", "Castle", "Overworld", "Desert", "Comedy"
    ];
    this.settingsMenu.items[2].options = [
      "Menus", "Water", "Underground", "Overworld 1", "Castle", "Overworld 2", "Sky", "Athletic"
    ];
    this.settingsMenu.items[8].options = [
      "Square", "Long", "Tall" // sizes: (32, 24) (48, 20) (20, 48)
    ];
    this.settingsMenu.items[1].current = this.level.background;
    this.settingsMenu.items[2].current = this.level.music;
    switch (this.level.width) {
      case 32: this.settingsMenu.items[8].current = 0; break;
      case 48: this.settingsMenu.items[8].current = 1; break;
      case 20: this.settingsMenu.items[8].current = 2; break;
    }
    this.selectedBlock = 8;
    this.selectedX = 0;
    this.selectedY = 0;

    this.loadSpawns();

    this.blockList = [
      0,
      this.level.specialTiles.player,
      this.level.specialTiles.qblock,
      this.level.specialTiles.usedQblock,
      46, 47, 54, 55, // pipe tiles
      5, 7, 13, 14, 15, 21, 22, 23, 1, 9, 17, // overworld tiles
      35, 36, 43, 27, 28, // mushroom tiles
      63, 48, 44, 29, 30, 31, 37, 38, 39, // underground tiles
      62, 40, 25, 26, 33, 34, 41, 42, 57, 61, // castle tiles
      24, 32, 16, 8, // underwater tiles
      6, // sky tiles
      65, 66, 67, 68, 69, 70, 71, // desert tiles
    ];
  }

  loadSpawns() {
    this.spawns = [];
    for (let i = 0; i < this.level.width * this.level.height; i++) this.spawns.push(false);
    this.level.spawns.forEach(spawn => {
      this.set_spawn(spawn.x, Math.ceil(spawn.y), true);
    });
  }

  get_spawn(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) return false;
    else return this.spawns[y * this.level.width + x];
  }

  set_spawn(x, y, val) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.level.width && y < this.level.height)
      this.spawns[y * this.level.width + x] = val;
  }

  tick() {
    let lastShape = this.settingsMenu.items[8].current;
    switch (this.menuMode) {
      case "edit": this.menu.on_inputs(
        false, false, false, false, false, false, false,
        this.game.input.get_key_pressed(Input.MOUSE_LEFT),
        this.game.renderer.get_cam_coord_y(this.game.input.mousey),
        this.game.input.get_key_pressed(Input.MOUSE_MOVED)
      ); break;
      case "settings":
        this.settingsMenu.get_and_process_inputs(this.game.input, this.game.renderer);
        this.game.audio.play_music("mus" + this.settingsMenu.items[2].current);
        this.level.background = this.settingsMenu.items[1].current;
        break;
    }

    if (this.pickCooldown > 0) this.pickCooldown--;

    if (this.pickCooldown <= 0 && this.menuMode == "settings" &&
        lastShape != this.settingsMenu.items[8].current) {
      let [nw, nh] = [32, 24];
      switch (this.settingsMenu.items[8].current) {
        case 1: nw = 48; nh = 20; break;
        case 2: nw = 20; nh = 48; break;
      }
      this.level.createNew(this.game.audio, false, nw, nh);
      this.loadSpawns();
    }

    if (this.menuMode == "edit") {
      let camspd = 0.15;
      this.game.renderer.get_camera().x += (this.game.input.get_key(Input.RIGHT) - this.game.input.get_key(Input.LEFT)) * camspd;
      this.game.renderer.get_camera().y += (this.game.input.get_key(Input.UP) - this.game.input.get_key(Input.DOWN)) * camspd;
    
      this.selectedX = Math.floor(this.game.renderer.get_cam_coord_x(this.game.input.mousex));
      this.selectedY = Math.floor(this.game.renderer.get_cam_coord_y(this.game.input.mousey));
      if (this.game.input.get_key(Input.MOUSE_LEFT) && this.pickCooldown <= 0 && this.selectedBlock != 1) {
        this.level.set_tile(this.selectedX, this.selectedY, this.blockList[this.selectedBlock]);
      }
      if (this.game.input.get_key_pressed(Input.MOUSE_LEFT) && this.pickCooldown <= 0 && this.selectedBlock == 1) {
        this.set_spawn(this.selectedX, this.selectedY, !this.get_spawn(this.selectedX, this.selectedY));
      }
    }

    if (this.menuMode == "block") {
      let lx = Math.floor(this.game.renderer.get_cam_coord_x(this.game.input.mousex) - this.game.renderer.get_camera().x) + 3;
      let ly = -Math.floor(this.game.renderer.get_cam_coord_y(this.game.input.mousey) - this.game.renderer.get_camera().y) + 3;
      lx = Math.max(0, Math.min(6, lx));
      ly = Math.max(0, Math.min(7, ly));
      this.selectedBlock = Math.min(ly*7+lx, this.blockList.length - 1);

      if (this.pickCooldown <= 0 && this.game.input.get_key_pressed(Input.MOUSE_LEFT)) {
        this.pickCooldown = 10;
        this.menuMode = "edit";
      }
    }
  }

  draw() {
    // Draw the level
    this.level.draw(this.game.renderer, this.game.gfxframe);

    // Draw the spawns
    this.spawns.forEach((val, i) => {
      let x = Math.floor(i % this.level.width);
      let y = Math.floor(i / this.level.width);
      if (val)
        this.game.renderer.draw("tex_terrain", x + 0.5, y + 0.5, -0.2, 0, 1, 1, this.blockList[1]-1);
    });

    // Draw the current menu
    switch (this.menuMode) {
      case "edit":
        this.menu.draw();
        if (this.blockList[this.selectedBlock] > 0)
          this.game.renderer.draw("tex_terrain", this.selectedX + 0.5, this.selectedY + 0.5, -0.01, 0, 1, 1, this.blockList[this.selectedBlock]-1);
        else
          this.game.renderer.draw("tex_selector", this.selectedX + 0.5, this.selectedY + 0.5, -0.01, 0, 1, 1, 0);
        break;
      case "settings": this.settingsMenu.draw(); break;
      case "block":
        let basey = this.game.renderer.get_camera().y+3;
        let basex = this.game.renderer.get_camera().x-3;
        this.blockList.forEach((blk, idx) => {
          let x = (idx % 7) + basex;
          let y = -Math.floor(idx / 7) + basey;
          let id = blk - 1;
          if (this.level.props[blk].animated)
            id += Math.floor((this.game.gfxframe / 15) % 4);

          if (blk)
            this.game.renderer.draw("tex_terrain", x + 0.5, y + 0.5, -0.01, 0, 1, 1, id);
          if (this.selectedBlock == idx)
            this.game.renderer.draw("tex_selector", x + 0.5, y + 0.5, 0, 0, 1, 1, 0);
        });
        break;
    }
    
    this.game.renderer.present_sprites();
  }
}
