import { parse, parseRawTranslation, injectTranslation } from "./util/translation.mjs";
import { writeFileSync, mkdirSync, readFileSync, write, read } from "node:fs";
import { resolve } from "node:path";
const l10nCode = process.argv[2];
if(l10nCode == undefined){
    console.log("Please provide a language code")
    process.exit(1);
}
// import data from "../jsons/api-ra.json" assert { type: "json" };
try{
    const data = JSON.parse(readFileSync(resolve(`./doc-jsons/staging`, `api.json`), 'utf8')); 
    const translationData = JSON.parse(readFileSync(resolve(`./doc-jsons/staging/${l10nCode}`, `translationItems.json`), 'utf8'));
    const translations = JSON.parse(readFileSync(resolve(`./doc-jsons/staging/${l10nCode}`, `editThisFile.json`), 'utf8'));
    for (const translationKey of Object.keys(translations)) {
        const translationItem = translationData[translationKey];
        if(translationItem == undefined){
            console.log(`Translation item not found for ${translations[translationKey].translationKeys}`);
            process.exit(1);
        }
        translationItem.translation = translations[translationKey].translation;
    }
    if(data == undefined){
        console.log("raw api data is not found")
        process.exit(1);
    }
    const res = parse(data);
    const discrepencies = parseRawTranslation(res.tree, translationData);
    if(discrepencies.length == 0){
        console.log("No discrepencies found");
        injectTranslation(res.tree, translationData);
        writeFileSync(resolve(`./doc-jsons/staging/${l10nCode}`, "translationItems.json"), JSON.stringify(translationData, null, 2));
        writeFileSync(resolve(`./doc-jsons/staging/${l10nCode}`, "api.json"), JSON.stringify(data, null, 2));
    } else {
        console.log("Discrepencies found");
        console.log(discrepencies);
    }
} catch(e) {
    console.log("There is an error parsing the raw api data");
    console.log(e);
    process.exit(1);
}