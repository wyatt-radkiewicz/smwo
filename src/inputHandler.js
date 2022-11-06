export const LEFT = 0;
export const RIGHT = 1;
export const UP = 2;
export const DOWN = 3;
export const RESTART = 4;
export const RUN = 5;
export const ENTER = 6;
export const MOUSE_LEFT = 7;
export const SCROLL_UP = 8;
export const SCROLL_DOWN = 9;
export const MOUSE_MOVED = 10;

export class InputHandler {
  constructor() {
    this.binds = [];
    this.binds[LEFT] = new KeyBind("ArrowLeft");
    this.binds[RIGHT] = new KeyBind("ArrowRight");
    this.binds[UP] = new KeyBind("ArrowUp");
    this.binds[DOWN] = new KeyBind("ArrowDown");
    this.binds[RESTART] = new KeyBind("r");
    this.binds[RUN] = new KeyBind("Shift");
    this.binds[ENTER] = new KeyBind("Enter");
    this.binds[MOUSE_LEFT] = new KeyBind("");
    this.binds[SCROLL_UP] = new KeyBind("");
    this.binds[SCROLL_DOWN] = new KeyBind("");
    this.binds[MOUSE_MOVED] = new KeyBind("");
    this.mousex = 0;
    this.mousey = 0;
    this.lastChar = "";

    window.addEventListener("wheel", event => {
      if (event.deltaY < 0) this.binds[SCROLL_UP].pressed = true;
      if (event.deltaY > 0) this.binds[SCROLL_DOWN].pressed = true;
    });

    window.addEventListener("mousemove", event => {
      this.mousex = event.offsetX;
      this.mousey = event.offsetY;
      this.binds[MOUSE_MOVED].pressed = true;
      event.preventDefault();
    });

    window.addEventListener("mousedown", event => {
      this.binds[MOUSE_LEFT].state = true;
      this.binds[MOUSE_LEFT].pressed = true;
      event.preventDefault();
    });

    window.addEventListener("mouseup", event => {
      this.binds[MOUSE_LEFT].state = false;
      event.preventDefault();
    });

    window.addEventListener("keydown", event => {
      this.binds.forEach(bind => {
        if (event.key == bind.name) {
          bind.state = true;
          if (!event.repeat) bind.pressed = true;
        }
      });

      this.lastChar = event.key.toLowerCase();
      if (/([^a-z0-9_])/.test(this.lastChar) || this.lastChar.length > 1) {
        if (event.key == "Backspace" || event.key == "Delete") this.lastChar = "_del";
        else if (event.shiftKey && event.key == "Subtract") this.lastChar = "_";
        else this.lastChar = "";
      }

      event.preventDefault();
    });

    window.addEventListener("keyup", event => {
      this.binds.forEach(bind => {
        if (event.key == bind.name) {
          bind.state = false;
          bind.pressed = false;
        }
      });

      event.preventDefault();
    });
  }

  get_key(key) {
    return this.binds[key].state;
  }

  get_key_pressed(key) {
    return this.binds[key].pressed;
  }

  clear_pressed() {
    this.binds.forEach(bind => {
      bind.pressed = false;
    });
    this.lastChar = "";
  }
}

class KeyBind {
  constructor(keyname) {
    this.state = false;
    this.name = keyname;
    this.pressed = false;
  }
}
