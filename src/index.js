import { createGame, getGame } from "./game";
import TitleState from "./titleState";
import { checkBrowserType } from "./browser";

checkBrowserType();

document.getElementById("start_button").onclick = () => {
  let playerName = document.getElementById("player_name").value.toLowerCase();
  let error = validatePlayerName(playerName);
  if (error == null) {
    document.getElementById("loading_screen").remove();
    createGame(playerName);
    getGame().currentState = new TitleState(getGame());
  }
  else {
    document.getElementById("name_error").innerHTML = error;
    document.getElementById("name_error").classList.add("errored");
  }
};

function validatePlayerName(name) {
  if (name.indexOf(' ') >= 0)
    return "You can't make a name with whitespace";
  if (name.length > 15)
    return "You can't make a name bigger than 15 letters";
  if (name == null || name == "" || name.length == 0)
    return "You need to enter a name";
  if (/([^A-Za-z0-9_])/.test(name))
    return "A name can only have alpha-numeric characters or an _";
  return null;
}
