export default class TitleBackground {
  constructor(game) {
    this.renderer = game.renderer;
    this.card_y = 1;
    game.audio.play_music("mus0");
  }

  draw() {
    let w = this.renderer.get_camera().w;
    let h = this.renderer.get_camera().h;
    let b = this.renderer.get_camera().size();
    let ty = (h/3*2 - h*2)*this.card_y + h/3*2;
    this.card_y *= 0.8;
    
    this.renderer.get_camera().move(0, 0);
    this.renderer.get_camera().scale = 1.0;
    this.renderer.draw("tex_title_bg", 0, 0, -10, 0, b*16/7, b*9/7, 0);
    this.renderer.draw("tex_title_bg", 0, 0, -11, 0, b*32/7, b*18/7, 0);
    this.renderer.draw("tex_title", 0, ty, -5, 0, b*198/300, b*94/300, 0);
  }
}
