// Drop-in replacement for the Claude-artifact-only `window.storage` API,
// backed by the browser's localStorage so the app works once deployed
// outside of Claude (e.g. on GitHub Pages). Data is per-browser/per-device
// only — it does not sync across devices.

const PREFIX = "pt-app:";

export const storage = {
  async get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return null;
      return { key, value: raw };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },
  async delete(key) {
    try {
      localStorage.removeItem(PREFIX + key);
      return { key, deleted: true };
    } catch (e) {
      return null;
    }
  },
};
