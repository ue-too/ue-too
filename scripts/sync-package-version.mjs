import path from "path";
import data from "../build/package.json" assert { type: "json" };
import mainData from "../package.json" assert { type: "json" };

const buildMajorVersion = data.version.split(".")[0];
const buildMinorVersion = data.version.split(".")[1];
const buildPatchVersion = data.version.split(".")[2];
console.log(`Current version: ${mainData.version}`);
mainData.version = `${buildMajorVersion}.${buildMinorVersion}.${buildPatchVersion}`;
console.log(`Synced version: ${mainData.version}`);

import { writeFileSync } from "fs";
writeFileSync("./package.json", JSON.stringify(mainData, null, 2));