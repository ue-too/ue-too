import mainData from "../package.json" assert { type: "json" };

console.log(`Current version: ${mainData.version}`);
console.log(`Passed In Version: ${process.argv[2]}`);
const [buildMajorVersion, buildMinorVersion, buildPatchVersion] = process.argv[2].split(".");
mainData.version = `${buildMajorVersion}.${buildMinorVersion}.${buildPatchVersion}`;
import { writeFileSync } from "fs";
writeFileSync("./package.json", JSON.stringify(mainData, null, 2));