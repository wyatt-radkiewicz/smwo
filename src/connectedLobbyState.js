import * as Input from "./inputHandler.js";
import LevelState from "./levelState.js";
import MenuStack from "./menuStack.js";
import TitleBackground from "./titleBackground.js";
import * as Network from "./network";
import { SHADER_NONE } from "./game";
import { hasLevelCookie } from "./level";

export default class ConnnectedLobbyState {
  constructor(game, isHost, /** @type {Network.Lobby} */ lobby) {
    this.game = game;
    this.isHost = isHost;
    this.lobby = lobby;
    this.bg = new TitleBackground(game);
    this.game.shader = SHADER_NONE;

    if (this.isHost) {
      this.lobby.send("scl", {});
      this.menu = new MenuStack(
        this.game.renderer, this.game.audio,
        "gamemode", null,
        "time/kill limit", null,
        "level", null,
        "start!", (idx) => {
          let lvlid = this.menu.items[idx-1].current;
          if (this.menu.items[idx-1].current == this.menu.items[idx-1].options.length-1 && hasLevelCookie())
            lvlid = -1; // Custom level
          let mode = this.menu.items[0].current;
          let limit = parseInt(this.menu.items[1].options[this.menu.items[1].current], 10);
          this.lobby.send("start", {
            id: lvlid,
            mode: mode,
            limit: limit
          });
          this.game.currentState = new LevelState(this.game, lvlid, this.lobby, this.isHost, mode, limit);
        },
      );
  
      this.menu.items[0].options = [
        "deathmatch", "chicken", "bombomb", "greed",
      ];
      this.menu.items[1].options = [
        "10", "20", "40", "60", "80", "100", "200", "300", "500", "1000", "2000"
      ];
      this.menu.items[2].options = [
        "Overworld", "Sky", "Underground", "Water", "Castle", "Pipe Towers", "Mushrooms", "Overworld Tall", "Desert", "<Your Level>"
      ];

      if (!hasLevelCookie()) this.menu.items[2].options.pop();
    }
    else {
      this.lobby.onmessage = (ty, msg) => {
        if (ty === "start") { // We've started the game
          this.game.currentState = new LevelState(this.game, msg.id, this.lobby, false, msg.mode, msg.limit);
        }
      };
      this.menu = new MenuStack(
        this.game.renderer, this.game.audio,
        "Host is Choosing Gamemode...", null,
      );
      this.lobby.playerNames.forEach((name, idx) => {
        this.menu.set_item(1 + idx, name, null);
      });
    }
    this.lobby.stopWaitingForPlayers();
  }

  tick() {
    this.menu.get_and_process_inputs(this.game.input, this.game.renderer);
  }

  draw() {
    this.bg.draw();
    this.menu.draw();
    this.game.renderer.present_sprites();
  }
}
