import Renderer from "./renderer.js";
import * as Input from "./inputHandler.js";
import AudioManager from "./audioManager.js";

export {
  Input,
  Renderer,
  AudioManager
};

export const SHADER_NONE = 0;
export const SHADER_WATER = 1;
export const SHADER_DARK = 2;
export const SHADER_HEAT = 3;
export const FPS = 60;

var game;

export function createGame(playerName) {
  game = {
    renderer : new Renderer(document.getElementById("game_screen")),
    audio : new AudioManager(),
    input : new Input.InputHandler(),
    frame : 0,
    gfxframe : 0,
    shader : SHADER_NONE,
    currentState : null,
    _cs : null,
    playerName : playerName,
  };
  game.renderer.load_content();
  game.audio.load_content();
  window.setInterval(tick, (1 / FPS) * 1000);
  window.requestAnimationFrame(draw);
}

export function getGame() {
  return game;
}

function tick() {
  game._cs = game.currentState;
  if (game._cs != null)
  game._cs.tick();
  game.input.clear_pressed();
  game.frame++;
}

function draw() {
  game.renderer.clear(1.0, 0.0, 0.0);
  if (game._cs != null)
  game._cs.draw();
  game.renderer.finalize(game.shader === SHADER_WATER, game.shader === SHADER_DARK, game.shader === SHADER_HEAT, game.gfxframe);
  game.gfxframe++;
  window.requestAnimationFrame(draw);
}
