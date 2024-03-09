import { readFile, readFileSync, write, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from "crypto";
import * as typedoc from "typedoc";

const reflectionKind = typedoc.ReflectionKind;
const constantGroup = {
    "Constructors": "placeholder",
    "Properties": "placeholder",
    "Methods": "placeholder",
    "Accessors": "placeholder",
    "Methods": "placeholder"
};

const localizeCode = process.argv[2];
if(localizeCode == undefined){
    console.error("No localization code provided");
    process.exit(1);
}

let structure = {};
let translationList = [];
const flatList = {};
const path = [];

try{
    const translationJSON = JSON.parse(readFileSync(resolve(`jsons/${localizeCode}`, `api-translation-tree-${localizeCode}.json`), 'utf8'));
    const translationListData = JSON.parse(readFileSync(resolve(`jsons/${localizeCode}`, `translation-${localizeCode}.json`), 'utf8'));
    const data = JSON.parse(readFileSync(resolve("jsons", `api-translation-stripped.json`), 'utf8'));
    const testNodes = {"@niuee/board": crawlAsTree(data)};
    translationListData.forEach((translationItem)=>{
        if(translationItem.translation === ""){
            return;
        }
        const item = getByPath(translationJSON, translationItem.translationJSONPath);
        const translationKey = translationItem.translationKey;
        item.translation = translationItem.translation;
        if(item.translationKey !== translationKey){
            console.error(`Translation key mismatch: ${translationKey} !== ${item.translationKey}`);
            process.exit(1);
        }
        const projectPath = item.projectPath;
        let projectItem = getByPathShort(testNodes, projectPath);
        projectItem[projectPath[projectPath.length - 1]] = translationItem.translation;
    });
    writeFileSync(resolve("jsons", `api-${localizeCode}.json`), JSON.stringify(data, null, 2));
} catch (e){
    console.error("Error reading translation file", e);
    process.exit(1);
}

function getByPath(root, path){
    let obj = root;
    for(let index = 0; index < path.length; index++){
        if(obj === undefined){
            console.error("Path not found", path);
            process.exit(1);
        }
        if(path[index].length >= 5 && path[index].substring(0, 5) === "index"){
            const indexInPath = parseInt(path[index].substring(6));
            obj = obj[indexInPath];
            continue;
        }
        obj = obj[path[index]];
    }
    return obj;
}

function getByPathShort(root, path){
    let obj = root;
    for(let index = 0; index < path.length - 1; index++){
        if(obj === undefined){
            console.error("Path not found", path);
            process.exit(1);
        }
        if(path[index].length >= 5 && path[index].substring(0, 5) === "index"){
            const indexInPath = parseInt(path[index].substring(6));
            obj = obj[indexInPath];
            continue;
        }
        obj = obj[path[index]];
    }
    return obj;

}

function crawlAsTree(node){
    if((node.flags && "isExternal" in node.flags && node.flags.isExternal)){
        return undefined;
    }
    path.push(node.name);
    flatList[node.id] = {};
    flatList[node.id].name = node.name;
    // res created from node so manipulation of res will affect node on properties that are not path
    const res = Object.create(node);
    res.path = [...path];
    getCategoryStrings(flatList[node.id], res);
    getComment(flatList[node.id], res);
    getGroups(flatList[node.id], res);
    const kind = reflectionMapping(node);
    const kindKeys = Object.keys(node);
    const kindKey = `${kind}Reflection`;
    if(structure[kindKey] == undefined){
        structure[kindKey] = [];
    }
    const curKindKeys = [...structure[kindKey]];
    for (const key of kindKeys){
        if (!curKindKeys.includes(key)){
            curKindKeys.push(key);
        }
    }
    structure[kindKey] = curKindKeys;
    if (node.children){
        for (const child of node.children){
            res[child.name] = crawlAsTree(child);
        }
    }
    if (node.signatures){
        node.signatures.forEach((signature)=>{
            res[signature.name] = crawlAsTree(signature);
        });
    }
    if (node.getSignature){
        res[node.getSignature.name] = crawlAsTree(node.getSignature);
    }
    if (node.setSignature){
        res[node.setSignature.name] = crawlAsTree(node.setSignature);
    }
    if(Object.keys(flatList[node.id]).length === 1 && Object.keys(flatList[node.id])[0] === "name"){
        delete flatList[node.id];
    }
    path.pop();
    return res;
}

function getCategoryStrings(flatListItem, node){
    if (node.categories){
        flatListItem.categories = node.categories.map((category, index) => {
            const translationJSONPath = [`${node.id}`, `categories`, `index-${index}`];
            const projectPath = [...node.path, "categories", `index-${index}`]
            const translationKey = crypto.createHash('md5').update(`${projectPath.join("")}${category.title}${"category"}`).digest('hex');
            const locationIdentifier = crypto.createHash('md5').update(`${translationJSONPath.join("")}${category.title}${"category"}`).digest('hex');
            const item = { translationKey: translationKey, translationJSONPath: translationJSONPath, projectPath: projectPath, originalText: category.title, translation: "", kind: "category", locationIdentifier: locationIdentifier};
            translationList.push({
                translationKey: translationKey,
                translationJSONPath: translationJSONPath,
                originalText: item.originalText,
                translation: "",
                kind: item.kind,
            });
            return item;
        });
    }
}

function getGroups(flatListItem, node){
    if(node.groups){
        flatListItem.groups = [];
        node.groups.forEach((group, index) => {
            // if(group.title in constantGroup){
            //    return; 
            // }
            const projectPath = [...node.path, "groups", `index-${index}`];
            const translationJSONPath = [];
            translationJSONPath.push(`${node.id}`);
            translationJSONPath.push("groups");
            translationJSONPath.push(`index-${flatListItem.groups.length}`);
            const translationKey = crypto.createHash('md5').update(`${projectPath.join("")}${group.title}${"group"}`).digest('hex');
            const locationIdentifier = crypto.createHash('md5').update(`${translationJSONPath.join("")}${group.title}${"group"}`).digest('hex');
            const item = { translationKey: translationKey, translationJSONPath: translationJSONPath, projectPath: projectPath, originalText: group.title, translation: "", kind: "group", locationIdentifier: locationIdentifier};
            flatListItem.groups.push(item);
            if(!(group.title in constantGroup)){
                translationList.push({
                    translationKey: translationKey,
                    translationJSONPath: translationJSONPath,
                    originalText: item.originalText,
                    translation: "",
                    kind: item.kind,
                });
            }
        });
        if(flatListItem.groups.length === 0){
            delete flatListItem.groups;
        }
    }
}

function getComment(flatListItem, node){
    if(node.comment){
        if(node.comment.summary == undefined){
            node.comment.summary = [];
        }
        if(node.comment.blockTags){
            node.comment.blockTags.forEach((comment)=>{
                if(comment.tag !== "@translation"){
                    return;
                }
                if(flatListItem.comments == undefined){
                    flatListItem.comments = [];
                }
                comment.content.forEach((content, index)=>{
                    if(content.kind !== "text"){
                        return;
                    }
                    const item = {};
                    item.originalText = content.text;
                    item.translation = "";
                    item.translationJSONPath = [];
                    item.translationJSONPath.push(`${node.id}`);
                    item.translationJSONPath.push("comments");
                    item.translationJSONPath.push(`index-${index}`);
                    const insertAtSummary = node.comment.summary.length;
                    item.projectPath = [...node.path, "comment", "summary",`index-${insertAtSummary}`];
                    node.comment.summary.push(content);
                    item.kind = reflectionMapping(node);
                    const locationIdentifier = crypto.createHash('md5').update(`${item.translationJSONPath.join("")}${item.originalText}${item.kind}`).digest('hex');
                    item.translationKey = crypto.createHash('md5').update(`${item.projectPath.join("")}${item.originalText}${item.kind}`).digest('hex');
                    item.locationIdentifier = locationIdentifier;
                    flatListItem.comments.push(item);
                    translationList.push({
                        translationKey: item.translationKey,
                        translationJSONPath: item.translationJSONPath,
                        originalText: item.originalText,
                        translation: "",
                        item: item.kind,
                    });
                });
            });
            node.comment.blockTags = node.comment.blockTags.filter((comment)=>{
                return comment.tag !== "@translation";
            });
            if(node.comment.blockTags.length === 0){
                delete node.comment.blockTags;
            }

        }
    }
}

function reflectionMapping(node){
    if(node.kind == undefined){
        return "unknown";
    }
    switch(node.kind){
    case reflectionKind.Project:
        return "project";
    case reflectionKind.Module:
        return "module";
    case reflectionKind.Namespace:
        return "namespace";
    case reflectionKind.Enum:
        return "enum";
    case reflectionKind.EnumMember:
        return "enumMember";
    case reflectionKind.Variable:
        return "variable";
    case reflectionKind.Function:
        return "function";
    case reflectionKind.Class:
        return "class";
    case reflectionKind.Interface:
        return "interface";
    case reflectionKind.Constructor:
        return "constructor";
    case reflectionKind.Property:
        return "property";
    case reflectionKind.Method:
        return "method";
    case reflectionKind.CallSignature:
        return "callSignature";
    case reflectionKind.IndexSignature:
        return "indexSignature";
    case reflectionKind.ConstructorSignature:
        return "constructorSignature";
    case reflectionKind.Parameter:
        return "parameter";
    case reflectionKind.TypeLiteral:
        return "typeLiteral";
    case reflectionKind.TypeParameter:
        return "typeParameter";
    case reflectionKind.Accessor:
        return "accessor";
    case reflectionKind.GetSignature:
        return "getSignature";
    case reflectionKind.SetSignature:
        return "setSignature";
    case reflectionKind.TypeAlias:
        return "typeAlias";
    case reflectionKind.Reference:
        return "reference";
    default:
        return "unknown";
    }
}
