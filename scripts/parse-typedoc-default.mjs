import { readFile, readFileSync, write, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import data from '../jsons/api.json' assert { type: 'json' };
import * as typedoc from "typedoc";
import crypto from "crypto";


const reflectionKind = typedoc.ReflectionKind;
const constantGroup = {
    "Constructors": "placeholder",
    "Properties": "placeholder",
    "Methods": "placeholder",
    "Accessors": "placeholder",
    "Methods": "placeholder",
    "Namespaces": "placeholder",
    "Classes": "placeholder",
    "Interfaces": "placeholder",
    "Type Aliases": "placeholder",
    "Functions": "placeholder",
};


function bfs(node){
    const res = [];
    const queue = [node];
    while (queue.length > 0){
        const length = queue.length;
        const level = {};
        for(let index = 0; index < length; index++){
            const curNode = queue.shift();
            level[curNode.name] = curNode;
            if (curNode.children){
                queue.push(...curNode.children);
            }
        }
        res.push(level);
    }
    return res;
}

let structure = {};
let translationList = [];
const flatList = {};
const path = [];

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
    if(Object.keys(flatList[node.id]).length === 1 && Object.keys(flatList[node.id])[0] === "name"){
        delete flatList[node.id];
    }
    path.pop();
    return res;
}

const testNodes = {"@niuee/board": crawlAsTree(data)};
// console.log(structure);
writeFileSync(resolve("jsons", "api-tree.json"), JSON.stringify(testNodes, null, 2));
writeFileSync(resolve("jsons", "api-structure.json"), JSON.stringify(structure, null, 2));
writeFileSync(resolve("jsons", "api-translation-stripped.json"), JSON.stringify(data, null, 2));

function getCategoryStrings(flatListItem, node){
    if (node.categories){
        flatListItem.categories = node.categories.map((category, index) => {
            const translationJSONPath = [`${node.id}`, `categories`, `index-${index}`];
            const projectPath = [...node.path, "categories", `index-${index}`, "title"];
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
            if(group.title in constantGroup){
               return; 
            }
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

function getByPath(root, path){
    let obj = root;
    for(let index = 0; index < path.length; index++){
        if(path[index].length >= 5 && path[index].substring(0, 5) === "index"){
            const indexInPath = parseInt(path[index].substring(6));
            obj = obj[indexInPath];
            continue;
        }
        obj = obj[path[index]];
    }
    return obj;
}
