import data from "../build/package.json" assert { type: "json" };
data.main = "./index.cjs";
data.module = "./index.js";
data.types = "./index.d.ts";
data.scripts = { test: "echo \"Error: no test specified\" && exit 1"};
const majorVersion = data.version.split(".")[0];
const minorVersion = data.version.split(".")[1];
const patchVersion = data.version.split(".")[2];
console.log(`Current version: ${data.version}`);
data.version = `${parseInt(majorVersion) + 1}.${minorVersion}.${patchVersion}`;

import { writeFileSync } from "fs";
writeFileSync("./build/package.json", JSON.stringify(data, null, 2));