import data from "../package.json" assert { type: "json" };
data.main = "./index.cjs";
data.module = "./index.js";
data.types = "./index.d.ts";
data.scripts = { test: "echo \"Error: no test specified\" && exit 1"};

import { writeFileSync } from "fs";
writeFileSync("./build/package.json", JSON.stringify(data, null, 2));
