export var browserType;

export function checkBrowserType() {
  let user = navigator.userAgent.toLowerCase();
  if (user.indexOf("chrome") > -1) browserType = "c";
  if (user.indexOf("msie") > -1 ||
      user.indexOf("rv:") > -1) browserType = "ie";
  if (user.indexOf("safari") > -1 &&
      user.indexOf("chrome") == -1) browserType = "s";
  if (user.indexOf("firefox") > -1) browserType = "f";
  if (user.indexOf("op") > -1 &&
      user.indexOf("chrome") == -1) browserType = "op";
}
