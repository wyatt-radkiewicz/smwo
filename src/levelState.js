import * as Input from "./inputHandler.js";
import { SHADER_DARK, SHADER_NONE, SHADER_WATER, SHADER_HEAT } from "./game";
import { Level } from "./level";
import {Player, playerFromJSON} from "./player";
import * as Network from "./network";
import ConnnectedLobbyState from "./connectedLobbyState.js";
import { DroppedCoin, lvlObjectFromJSON } from "./levelObjects";

export default class LevelState {
  constructor(game, levelid, /** @type {Network.Lobby} */ lobby, isHost, gamemode, modeLimit) {
    this.game = game;
    this.gamemode = gamemode;
    this.modeLimit = modeLimit;
    this.winner = -1;
    this.winnerScreenTimer = 0;
    this.bombTimer = 5;
    this.lobby = lobby;
    this.isHost = isHost;
    this.hostCoinSpawnCooldown = [];
    this.level = new Level();
    if (!this.isHost && levelid == -1) // Load the host's custom level
      this.level.loadFromCustomFormat(lobby.remoteLevelString, this.game.audio);
    else
      this.level.load(levelid, this.game.audio);
    this.lvlObjects = {};
    this.nextObjUUID = 0;
    this.game.shader = SHADER_NONE;
    if (this.level.background == 1) this.game.shader = SHADER_WATER;
    if (this.level.background == 2 || this.level.background == 3) this.game.shader = SHADER_DARK;
    if (this.level.background == 5) this.game.shader = SHADER_HEAT;
    this.game.audio.play("snd_start", false);
    this.players = [];
    for (let i = 0; i < this.lobby.playerNames.length; i++) {
      this.players.push(new Player(this.level, i, this.gamemode, this.lobby.playerNames[i]));
      this.hostCoinSpawnCooldown.push(0);
    }

    this.lobby.onmessage = (ty, msg) => {
      if (ty == "pl") { // Update player list
        //this.players.splice(msg.removed, 1);
        let players = this.players;
        this.players = [];
        players.forEach(player => {
          let match = false;
          msg.list.forEach(name => {
            if (name == player.name) match = true;
          });
          if (match) this.players.push(player);
        });
        console.log("removed player");
      }
      if (ty == "pu") {
        if (this.isHost)
          this.lobby.sendUnreliable(ty, msg);
        if (msg.id != this.lobby.playerIdx)
          this.players[msg.id] = playerFromJSON(msg.plr);
      }
      if (ty == "sq" || ty == "die") {
        if (this.isHost && this.gamemode == 3) this.spawnCoins(msg);
        if (msg == this.lobby.playerIdx) {
          if (this.gamemode != 3) {
            if (ty == "die") this.players[msg].die(this.game.audio);
            else this.players[msg].squash(this.game.audio);
          }
          else {
            this.game.audio.play("snd_hit", false);
            this.players[msg].kills = 0;
          }
        }
        else if (this.isHost) {
          this.lobby.send(ty, msg);
        }
      }
      if (ty == "set_tile") {
        if (this.isHost)
          this.lobby.send(ty, msg);
        this.level.set_tile(msg.x, msg.y, msg.id);
      }
      if (ty == "snd_chicken") {
        if (this.isHost)
          this.lobby.sendUnreliable(ty, msg);
        if (msg.sourceIdx != lobby.playerIdx)
          am.play("snd_chicken", false);
      }
      if (ty == "bombPass") {
        if (this.isHost)
          this.lobby.send(ty, msg);
        this.game.audio.play("snd_pass", false);
        if (msg == this.lobby.playerIdx)
          this.players[msg].bombomb = true;
      }
      if (ty == "bombExplosion") {
        this.bombTimer = this.modeLimit;
        this.game.audio.play("snd_bomb", false);
        if (msg == this.lobby.playerIdx) {
          this.players[msg].exploded = 60;
          this.players[msg].bombomb = false;
        }
      }
      if (ty == "timer") {
        if (this.gamemode != 2) this.modeLimit = msg;
        else this.bombTimer = msg;
      }
      if (ty == "roundEnd") {
        this.winner = msg;
        this.winnerScreenTimer = 60*6.5;
        this.game.audio.play_music("mus_gameover");
      }
      if (ty == "lo") {
        this.lvlObjects = {};
        for (const [uuid, obj] of Object.entries(msg))
          this.lvlObjects[uuid] = lvlObjectFromJSON(obj);
      }
      if (ty == "lod") {
        if (this.isHost && (msg in this.lvlObjects)) delete this.lvlObjects[msg];
      }
      if (ty == "cc") {
        if (this.isHost && (msg.id in this.lvlObjects) && this.lvlObjects[msg.id].type === "c") {
          this.lvlObjects[msg.id].playCollectAnim();
          this.lobby.send("is", msg.plr);
        }
      }
      if (ty == "is") {
        if (msg == this.lobby.playerIdx) {
          this.players[this.lobby.playerIdx].kills++;
          this.game.audio.play("snd_coin", false);
        }
      }
      if (ty == "ce") {
        if (this.isHost)
          this.lobby.sendUnreliable(ty, msg);
        if (msg.plr != this.lobby.playerIdx)
          this.level.spawn_coin_effect(this.game.audio, msg.x, msg.y);
      }
      if (ty == "scl" && this.winner != -1) {  // [S]tate [C]onnected [L]obby
        this.game.currentState = new ConnnectedLobbyState(this.game, this.isHost, this.lobby);
      }
    };
  }

  spawnCoins(playerIdx) {
    if (this.hostCoinSpawnCooldown[playerIdx] > 0) return;
    let player = this.players[playerIdx];
    this.hostCoinSpawnCooldown[playerIdx] = 80;
    for (let i = 0; i < player.kills; i++) {
      this.lvlObjects[this.nextObjUUID++] = new DroppedCoin(Math.floor(player.x)+0.5, Math.floor(player.y)+0.5);
    }
    player.kills = 0;
  }

  tick() {
    if (this.winner == -1 || this.winner == this.lobby.playerIdx) {
      this.players[this.lobby.playerIdx].update_inputs(
        this.game.input.get_key(Input.LEFT),
        this.game.input.get_key(Input.RIGHT),
        this.game.input.get_key(Input.UP),
        this.game.input.get_key_pressed(Input.DOWN),
        this.game.input.get_key(Input.RUN),
        this.game.input.get_key_pressed(Input.UP),
        this.game.input.get_key_pressed(Input.RUN)
      );
    }
    else {
      this.players[this.lobby.playerIdx].update_inputs(false, false, false, false, false, false, false);
    }

    // Update entities
    this.players.forEach((player, idx) => {
      player.update(this.level, this.game.audio, this.players, idx, this.lobby, this.gamemode, this.game.frame, this);
      if (this.hostCoinSpawnCooldown[idx] > 0) this.hostCoinSpawnCooldown[idx]--;
    });
    for (const [uuid, obj] of Object.entries(this.lvlObjects)) {
      if (!obj.tick(this.level)) delete this.lvlObjects[uuid];
    }

    if (this.game.frame % 6 == 0) {
      this.lobby.sendUnreliable("pu", {id: this.lobby.playerIdx, plr: this.players[this.lobby.playerIdx]});
      if (this.isHost) this.lobby.sendUnreliable("lo", this.lvlObjects);
    }
    if (this.game.frame % (60 * 5) == 0 && this.isHost) {
      this.level.respawn_qblocks(this.lobby);
    }

    // Win conditions and timers
    if (this.gamemode == 2 && this.game.frame % 60 == 0) {
      if (this.bombTimer > 0) this.bombTimer--;
      if (this.isHost) this.lobby.sendUnreliable("timer", this.bombTimer);
    }
    if (this.gamemode == 2 && this.isHost && this.winner == -1 && this.bombTimer == 0) {
      // Explode a bomb or something
      let bombIdx = -1;
      this.players.forEach((player, idx) => { if (player.bombomb) bombIdx = idx; });

      if (bombIdx != -1) { // Explode the person
        this.players[bombIdx].exploded = 60;
        this.lobby.send("bombExplosion", bombIdx);
        this.game.audio.play("snd_bomb", false);
      }

      // End the game?
      let numAlive = 0;
      this.players.forEach((player, idx) => {
        if (player.exploded <= 0) {
          numAlive++;
          bombIdx = idx;
        }
      });
      if (numAlive == 1) {
        this.broadcastWinner();
      }
      else {
        // Hand the bomb off to someone else
        let newBomb = Math.floor(Math.random() * (this.players.length - 0.001));
        while (this.players[newBomb].exploded > 0)
          newBomb = Math.floor(Math.random() * (this.players.length - 0.001));
        this.lobby.send("bombPass", newBomb);
        this.players[newBomb].bombomb = true;
        this.bombTimer = this.modeLimit;
      }
    }
    if ((this.gamemode == 1 || this.gamemode == 3) && this.game.frame % 60 == 0) {
      if (this.modeLimit > 0) this.modeLimit--;
      if (this.isHost) {
        if (this.modeLimit <= 0 && this.winner == -1)
          this.broadcastWinner();
        this.lobby.sendUnreliable("timer", this.modeLimit);
      }
    }
    if (this.gamemode == 0 && this.isHost) {
      this.players.forEach(player => {
        if (player.kills >= this.modeLimit && this.winner == -1)
          this.broadcastWinner();
      });
    }

    if (this.winnerScreenTimer > 0) this.winnerScreenTimer--;
    if (this.isHost && this.winnerScreenTimer <= 0 && this.winner != -1) {
      // Go back to connected lobby state
      this.lobby.send("scl", {});
      this.game.currentState = new ConnnectedLobbyState(this.game, this.isHost, this.lobby);
    }
  }

  broadcastWinner() {
    // Get the winner and broadcast it
    if (this.gamemode != 2) {
      let highest = -1;
      this.players.forEach((player, idx) => {
        if (player.kills > highest) {
          highest = player.kills;
          this.winner = idx;
        }
      });
    }
    else {
      this.players.forEach((player, idx) => {
        if (player.exploded <= 0) this.winner = idx;
      });
    }

    this.lobby.send("roundEnd", this.winner);

    // Set timer for go back time
    this.winnerScreenTimer = 60*6.5;
    this.game.audio.play_music("mus_gameover");
  }

  draw() {
    let focus = (this.winner == -1) ? this.lobby.playerIdx : this.winner;
    this.game.renderer.get_camera().move(this.players[focus].x, this.players[focus].y);
    this.game.renderer.get_camera().scale = 1.24999;
    this.level.draw(this.game.renderer, this.game.frame);
    this.players.forEach((player, idx) => {
      player.draw(this.game.renderer, this.lobby.playerNames[idx], this.game.gfxframe, this.winner == idx, this.level);
    });
    for (const [uuid, obj] of Object.entries(this.lvlObjects)) {
      obj.draw(this.game.renderer, this.game.gfxframe);
    }
    this.draw_hud();
    this.game.renderer.present_sprites();
  }

  draw_hud() {
    let x = this.game.renderer.get_camera().x;
    let y = this.game.renderer.get_camera().y;
    let w = this.game.renderer.get_camera().w*this.game.renderer.get_camera().scale;
    let h = this.game.renderer.get_camera().h*this.game.renderer.get_camera().scale;
    
    let gamemode = "Null Gamemode";
    let scoreCount = "score";
    switch (this.gamemode) {
      case 0:
        gamemode = "deathmatch until " + this.modeLimit + " kills";
        scoreCount = "kills: " + this.players[this.lobby.playerIdx].kills;
        break;
      case 1:
        gamemode = "chicken { " + this.modeLimit;
        scoreCount = "score: " + this.players[this.lobby.playerIdx].kills;
        break;
      case 2:
        gamemode = "bombomb { " + this.bombTimer;
        scoreCount = "safe";
        if (this.players[this.lobby.playerIdx].bombomb) scoreCount = "run!";
        if (this.players[this.lobby.playerIdx].exploded > 0) scoreCount = "dead";
        break;
      case 3:
        gamemode = "greed mode { " + this.modeLimit;
        scoreCount = "coins: " + this.players[this.lobby.playerIdx].kills;
        break;
    }
    this.game.renderer.draw_text(x-w+0.3, y+h-0.3, 0, 0.4, false, scoreCount);
    this.game.renderer.draw_text(x, y+h-0.3, 0, 0.4, true, gamemode);

    if (this.winnerScreenTimer > 60*4) {
      let yoff = Math.max(-h, (this.winnerScreenTimer-60*8)/20);
      this.game.renderer.draw("tex_game_over", x, y+h+yoff, 0, 0, 9.5, 2, 0);
    }

    let nameAndScores = [];
    let nameSpace = 0;
    this.players.forEach((plr, idx) => {
      let name = this.lobby.playerNames[idx];
      if (name.length + 5 > nameSpace) nameSpace = name.length + 5;
      if (idx == this.lobby.playerIdx) name += " *";
      nameAndScores.push({
        name: name,
        score: plr.kills
      });
    });
    nameAndScores.sort((a, b) => (a.score > b.score) ? -1 : 1);
    for (let i = 0; i < Math.min(5, nameAndScores.length); i++) {
      let pal = (i < 2) ? i+1 : 16;
      let text = nameAndScores[i].name;
      while (text.length < nameSpace) text += " ";
      text += nameAndScores[i].score.toString();
      this.game.renderer.draw_text_paletted(x-w+0.3, y+h-0.9-i*0.25, 0, 0.2, false, pal, text);
    }
  }
}
