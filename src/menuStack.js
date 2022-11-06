import * as Input from "./inputHandler";

const VIEWSIZE = 12;

export default class MenuStack {
  constructor(renderer, audio) {
    this.items = [];
    this.renderer = renderer;
    this.audio = audio;
    this.cursor = 0;
    this.view = 0;
    this.verticallyCentered = true;
    for (let i = 2; i + 1 < arguments.length; i += 2) {
      this.items.push({
        str: arguments[i],
        onclick: arguments[i + 1],
        options: [],
        current: 0
      });
    }
  }

  set_item(idx, str, onclick) {
    this.items[idx] = {
      str: str,
      onclick: onclick,
      options: [],
      current: 0
    };
  }

  get_and_process_inputs(input, renderer) {
    this.on_inputs(
      input.get_key_pressed(Input.UP),
      input.get_key_pressed(Input.DOWN),
      input.get_key_pressed(Input.LEFT),
      input.get_key_pressed(Input.RIGHT),
      input.get_key_pressed(Input.ENTER),
      input.get_key_pressed(Input.SCROLL_UP),
      input.get_key_pressed(Input.SCROLL_DOWN),
      input.get_key_pressed(Input.MOUSE_LEFT),
      renderer.get_cam_coord_y(input.mousey),
      input.get_key_pressed(Input.MOUSE_MOVED),
    );
  }

  on_inputs(up, down, left, right, enter, scroll_up, scroll_down, mouse_left, my, mouse_moved) {
    let lastCursor = this.cursor;
    my -= this.renderer.get_camera().y;
    right = right || mouse_left;
    enter = enter || mouse_left;
    if (up) this.cursor -= 1;
    if (down) this.cursor += 1;
    if (down && lastCursor == -1) this.cursor = this.view;
    if (up && lastCursor == -1) this.cursor = Math.min(this.view + VIEWSIZE - 1, this.items.length - 1);
    if ((up && this.cursor >= 0) || (down && this.cursor < this.items.length))
      this.audio.play("snd_cursor", false);
    if (lastCursor != -1) {
      if (this.cursor < 0) this.cursor = 0;
      if (this.cursor >= this.items.length) this.cursor = this.items.length - 1;
      if (this.cursor >= this.view + VIEWSIZE) this.view = this.cursor - VIEWSIZE + 1;
      if (this.cursor < this.view) this.view = this.cursor;
    }
    if (scroll_up && this.view > 0) {
      this.view--;
      if (this.cursor >= this.view + VIEWSIZE && this.cursor != -1) this.cursor = this.view + VIEWSIZE - 1;
    }
    if (scroll_down && this.view + VIEWSIZE < this.items.length) {
      this.view++;
      if (this.cursor < this.view && this.cursor != -1) this.cursor = this.view;
    }
    if (mouse_moved) {
      let oldCursor = this.cursor;
      if (this.verticallyCentered)
        my = (this.renderer.get_camera().h/4 - my) / 0.5;
      else
        my = (this.renderer.get_camera().h - 0.6 - my) / 0.5;
      this.cursor = this.view + Math.round(my);
      if (this.cursor < this.view || this.cursor > Math.min(VIEWSIZE - 1, this.items.length - 1)) this.cursor = -1;
      if (oldCursor != this.cursor) this.audio.play("snd_cursor", false);
    }
    if (this.cursor != -1 && this.items[this.cursor].options.length > 0) {
      let item = this.items[this.cursor];
      if (left) item.current -= 1;
      if (right) item.current += 1;
      if (item.current < 0) item.current = item.options.length - 1;
      if (item.current >= item.options.length) item.current = 0;
      if (left || right) this.audio.play("snd_cursor", false);
    }
    if (enter && this.cursor > -1 && this.items[this.cursor].onclick != null)
      this.items[this.cursor].onclick(this.cursor, this.items[this.cursor]);
  }

  draw() {
    let top = this.renderer.get_camera().y+this.renderer.get_camera().h-0.6;
    if (this.verticallyCentered)
      top = this.renderer.get_camera().y+this.renderer.get_camera().h/4;

    for (let i = this.view; i < this.view + VIEWSIZE && i < this.items.length; i++) {
      let item = this.items[i];
      let str = item.str;
      let x = this.renderer.get_camera().x;
      if (item.options.length > 0) {
        x += -this.renderer.get_camera().w / 3 * 2;
        str = item.str + ": " + item.options[item.current];
      }
      if (this.cursor == i) {
        str = "> " + str;
        if (item.options.length <= 0) str += " <";
      }
      this.renderer.draw_text(x, top-(i - this.view)*0.5, 0, 0.4, item.options.length <= 0, str);
    }
  }
}
