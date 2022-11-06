import * as Input from "./inputHandler.js";
import LobbyState from "./lobbyState.js";
import ClientLobbyState from "./clientLobbyState.js";
import MenuStack from "./menuStack.js";
import TitleBackground from "./titleBackground.js";
import LevelEditorState from "./levelEditorState.js";

export default class TitleState {
  constructor(game) {
    this.game = game;
    this.bg = new TitleBackground(game);
    this.menu = new MenuStack(
      this.game.renderer, this.game.audio,
      "host game", () => {
        this.game.currentState = new LobbyState(this.game);
      },
      "join game", () => {
        this.game.currentState = new ClientLobbyState(this.game);
      },
      "level editor", () => {
        this.game.currentState = new LevelEditorState(this.game);
      }
    );
  }

  tick() {
    this.menu.get_and_process_inputs(this.game.input, this.game.renderer);
  }

  draw() {
    this.game.renderer.get_camera().x = 0;
    this.game.renderer.get_camera().y = 0;
    this.bg.draw();
    this.menu.draw();
    this.game.renderer.present_sprites();
  }
}
