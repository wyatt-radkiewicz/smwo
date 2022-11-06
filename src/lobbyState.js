import MenuStack from "./menuStack.js";
import TitleBackground from "./titleBackground.js";
import * as Network from "./network";
import ConnnectedLobbyState from "./connectedLobbyState";
import Cookies from "js-cookie";

export default class LobbyState {
  constructor(game) {
    this.game = game;
    this.bg = new TitleBackground(game);
    this.menu = new MenuStack(
      this.game.renderer, this.game.audio,
      "************", async (idx, item) => {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(item.str);
        }
      },
      "", null,
      "Start Game", () => {
        this.game.currentState = new ConnnectedLobbyState(this.game, true, this.lobby);
      },
      "- Players -", null,
      "", null,
      this.game.playerName, null,
    );

    this.lobby = new Network.Lobby(this.game.playerName, (ty, msg) => {

    });
    let levelString = Cookies.get("lvl");
    if (levelString == undefined) levelString = "";
    this.lobby.waitForPlayers(levelString)
      .then((id) => {this.menu.items[0].str = id});
  }

  tick() {
    this.menu.get_and_process_inputs(this.game.input, this.game.renderer);
    for (let i = 0; i < this.lobby.playerNames.length; i++) {
      this.menu.set_item(5 + i, this.lobby.playerNames[i], null);
    }
    while (this.lobby.playerNames.length < this.menu.items.length - 5) {
      this.menu.items.pop();
    }
  }

  draw() {
    this.bg.draw();
    this.menu.draw();
    this.game.renderer.present_sprites();
  }
}
