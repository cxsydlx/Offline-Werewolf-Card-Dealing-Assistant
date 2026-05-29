const STORAGE_KEY = "werewolf_device_id";

export function getFingerprint(): string {
  let fp = localStorage.getItem(STORAGE_KEY);
  if (!fp) {
    fp = generateUUID();
    localStorage.setItem(STORAGE_KEY, fp);
  }
  return fp;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
