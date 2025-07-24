import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { cwd } from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json from current working directory instead of root
const packageJsonPath = join(cwd(), "package.json");
const data = JSON.parse(readFileSync(packageJsonPath, "utf8"));

data.main = "./index.cjs";
data.module = "./index.mjs";
data.types = "./index.d.ts";
data.scripts = { test: "echo \"Error: no test specified\" && exit 1"};

writeFileSync("./build/package.json", JSON.stringify(data, null, 2));

copyFileSync("./README.md", "./build/README.md");
copyFileSync("./LICENSE.txt", "./build/LICENSE.txt");
