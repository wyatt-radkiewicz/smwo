import MenuStack from "./menuStack.js";
import TitleBackground from "./titleBackground.js";
import * as Network from "./network";
import ConnnectedLobbyState from "./connectedLobbyState";

export default class ClientLobbyState {
  constructor(game) {
    this.game = game;
    this.isInLobby = false;
    this.bg = new TitleBackground(game);
    this.lastJoinCode = "";
    this.infoCooldown = -1;
    this.lobby = new Network.Lobby(this.game.playerName, (ty, msg) => {
      if (ty === "scl") {  // [S]tate [C]onnected [L]obby
        this.game.currentState = new ConnnectedLobbyState(this.game, false, this.lobby);
      }
    });
    this.lobby.clientOldLobbyNoCon = () => {
      this.isInLobby = false;
    };
    this.menu = new MenuStack(
      this.game.renderer, this.game.audio,
      "<Type for Join Code>", (idx, item) => {
        if (item.str != "Searching..." && item.str != "Already joining...") {
          this.lastJoinCode = item.str;
          this.infoCooldown = 60*1.25;
          this.lobby.connectToLobby(item.str)
            .then((code) => {
              item.str = code;
              this.isInLobby = true;
            })
            .catch((err) => {
              item.str = "Can't connect";
              if (err == "Already joining...")
                item.str = "Already joining...";
            });
          item.str = "Searching...";
        }
      },
      "", null,
      "- Players -", null,
      "", null,
      this.game.playerName, null,
    );
  }

  tick() {
    if (this.isInLobby && this.lobby.cons[0].safe != null && this.lobby.cons[0].safe.readyState == "open") {
      this.menu.items[0].str = this.lastJoinCode;
    }
    if (this.menu.items[0].str != "Searching..." && !this.isInLobby) {
      if (this.infoCooldown > -1 && this.infoCooldown-- == 0) {
        this.infoCooldown = -1;
        this.menu.items[0].str = this.lastJoinCode;
      }

      if (this.game.input.lastChar == "_del") {
        if (this.menu.items[0].str == "<Type for Join Code>" ||
            this.menu.items[0].str == "Can't connect" ||
            this.menu.items[0].str == "Already joining...") {
          this.menu.items[0].str = "";
        }
        this.menu.items[0].str = this.menu.items[0].str.slice(0, -1);
        this.infoCooldown = -1;
      }
      else {
        let lastStr = this.menu.items[0].str;
        if (this.game.input.lastChar != "" && (
          this.menu.items[0].str == "<Type for Join Code>" ||
          this.menu.items[0].str == "Can't connect" ||
          this.menu.items[0].str == "Already joining..."
        ))
          this.menu.items[0].str = "";
        this.menu.items[0].str += this.game.input.lastChar;
        if (lastStr != this.menu.items[0].str)
          this.infoCooldown = -1;
      }
    }

    this.menu.get_and_process_inputs(this.game.input, this.game.renderer);
    for (let i = 0; i < this.lobby.playerNames.length; i++) {
      this.menu.set_item(4 + i, this.lobby.playerNames[i], null);
    }
    while (this.lobby.playerNames.length < this.menu.items.length - 4) {
      this.menu.items.pop();
    }
  }

  draw() {
    this.bg.draw();
    this.menu.draw();
    this.game.renderer.present_sprites();
  }
}
