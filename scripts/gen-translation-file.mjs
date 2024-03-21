import { parse } from "./util/translation.mjs";
import { writeFileSync, mkdirSync, readFileSync, cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const l10nCode = process.argv[2];
if(l10nCode == undefined){
    console.log("Please provide a language code")
    process.exit(1);
}
// import data from "../jsons/api-ra.json" assert { type: "json" };
try{
    const data = JSON.parse(readFileSync(resolve(`./doc-jsons/staging`, `api-raw.json`), 'utf8')); 
    const prodTranslationPath = resolve(`./doc-jsons/prod/${l10nCode}`, `translationItems.json`);
    const curStagingEditFile = resolve(`./doc-jsons/staging/${l10nCode}`, `editThisFile.json`);
    const prodReadMEPath = resolve(`./doc-jsons/prod/${l10nCode}`, `README.md`);
    if(data == undefined){
        console.log("raw api data is not found")
        process.exit(1);
    }
    const res = parse(data);
    const editThisList = {};
    const translationKeys = Object.keys(res.translationObject);
    for (const key of translationKeys) {
        const editThisItem = {
            translationKeys: key,
        };
        editThisItem.kind = res.translationObject[key].kind;
        if(res.translationObject[key].kind == "group" || res.translationObject[key].kind == "category"){
            editThisItem.belongsTo = res.translationObject[key].belongsTo;
        } else {
            editThisItem.name = res.translationObject[key].name;
        }
        editThisItem.originalText = res.translationObject[key].originalText;
        editThisItem.translation = res.translationObject[key].translation;
        editThisList[key] = editThisItem;
    }
    if(existsSync(prodTranslationPath)){
        const prodTranslation = JSON.parse(readFileSync(resolve(`./doc-jsons/prod/${l10nCode}`, `translationItems.json`), 'utf8'));
        for (const key of Object.keys(prodTranslation)) {
            if(editThisList[key] != undefined && prodTranslation[key].translation != "" && prodTranslation[key].originalText == editThisList[key].originalText){
                editThisList[key].translation = prodTranslation[key].translation;
            }
        }
    }
    if(existsSync(curStagingEditFile)){
        const stagingEditFile = JSON.parse(readFileSync(curStagingEditFile, 'utf8'));
        for (const editItemKey of Object.keys(stagingEditFile)) {
            if(editThisList[editItemKey] !== undefined && stagingEditFile[editItemKey].translation != "" && stagingEditFile[editItemKey].originalText == editThisList[editItemKey].originalText){
                editThisList[editItemKey].translation = stagingEditFile[editItemKey].translation;
            }
        }
    }
    if(existsSync(prodReadMEPath)){
        cpSync(prodReadMEPath, `./doc-jsons/staging/${l10nCode}/README.md`);
    } else {
        cpSync(`./README.md`, `./doc-jsons/staging/${l10nCode}/README.md`);
    }
    mkdirSync(`./doc-jsons/staging/${l10nCode}`, {recursive: true});
    writeFileSync(`./doc-jsons/staging/${l10nCode}/editThisFile.json`, JSON.stringify(editThisList, null, 2));
    writeFileSync(`./doc-jsons/staging/${l10nCode}/translationItems.json`, JSON.stringify(res.translationObject, null, 2));
} catch(e) {
    console.log("There is an error parsing the raw api data");
    console.log(e);
    process.exit(1);
}

