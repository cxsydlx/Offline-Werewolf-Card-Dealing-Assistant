const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除 I、O、0、1

export function generateGameCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}
