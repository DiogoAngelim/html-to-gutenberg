import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "vendor", "fetch-page-assets", "index.js");
const targetPath = path.join(projectRoot, "node_modules", "fetch-page-assets", "index.js");

if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) {
  process.exit(0);
}

fs.copyFileSync(sourcePath, targetPath);
console.log("Applied local fetch-page-assets performance patch");
