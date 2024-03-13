import { parse } from "./util/translation.mjs";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
// import data from "../jsons/api-ra.json" assert { type: "json" };
try{
    const data = JSON.parse(readFileSync(resolve(`./doc-jsons/staging`, `api-raw.json`), 'utf8'));
    if(data == undefined){
        console.log("raw api data is not found")
        process.exit(1);
    }
    const res = parse(data);
    // mkdirSync("./jsons/staging", {recursive: true});
    writeFileSync(resolve("./doc-jsons/staging", "tree.json"), JSON.stringify(res.tree, null, 2));
    writeFileSync("./doc-jsons/staging/flat.json", JSON.stringify(res.flatList, null, 2));
    writeFileSync("./doc-jsons/staging/structure.json", JSON.stringify(res.structure, null, 2));
    writeFileSync("./doc-jsons/staging/api.json", JSON.stringify(data, null, 2));
} catch(e) {
    console.log("There is an error parsing the raw api data");
    console.log(e);
    process.exit(1);
}
