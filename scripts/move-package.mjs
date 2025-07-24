import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, "../package.json");
const data = JSON.parse(readFileSync(packageJsonPath, "utf8"));

data.main = "./index.cjs";
data.module = "./index.mjs";
data.types = "./index.d.ts";
data.scripts = { test: "echo \"Error: no test specified\" && exit 1"};

writeFileSync("./build/package.json", JSON.stringify(data, null, 2));

copyFileSync("./README.md", "./build/README.md");
copyFileSync("./LICENSE.txt", "./build/LICENSE.txt");
