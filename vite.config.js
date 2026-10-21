import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

function commitHash() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "";
  }
}

// Shown in the header so it is easy to tell whether a phone is running the
// latest deploy.
const buildDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_INFO__: JSON.stringify([buildDate, commitHash()].filter(Boolean).join(" · ")),
  },
});
