import {readFileSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";

try {
    // Code to strip lines 11 to 22 from the readme
    const readmePath = resolve("./README.md");
    const lines = readFileSync(readmePath, 'utf-8').split('\n');
    const updatedLines = [...lines.slice(0, 6), ...lines.slice(18)];
    // Save the updated content to a new file
    const newFilePath = resolve("./README-for-docusaurus.md");
    writeFileSync(newFilePath, updatedLines.join('\n'), 'utf-8');
} catch (e) {
    console.log("There is an error stripping the github specific section from the readme");
    console.log(e);
}