import data from "../package.json" assert { type: "json" };
data.main = "./index.cjs";
data.module = "./index.mjs";
data.types = "./index.d.ts";
data.scripts = { test: "echo \"Error: no test specified\" && exit 1"};

import { writeFileSync, copyFileSync } from "fs";
writeFileSync("./build/package.json", JSON.stringify(data, null, 2));

copyFileSync("./README.md", "./build/README.md");
copyFileSync("./LICENSE.txt", "./build/LICENSE.txt");
