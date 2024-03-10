import crypto from "crypto";
import data from "./testdata/api.json" assert {type: "json"};
import { resolve } from "path";
import { writeFileSync } from "fs";
import * as typedoc from "typedoc";


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

parse(data);

export function parse(dataNode){
    const translationItem = [];
    const tree = {"@niuee/board": dfs(dataNode, [])};
    const flattened = flatten(tree["@niuee/board"]);
    writeFileSync(resolve("scripts/util/testdata", "tree.json"), JSON.stringify(tree, null, 2));
    writeFileSync(resolve("scripts/util/testdata", "flattened.json"), JSON.stringify(flattened, null, 2));
    return tree;
}

function flatten(node){
    if (node == undefined){
        return undefined;
    }
    const list = {};
    const queue = [node];
    while (queue.length > 0){
        const current = queue.shift();
        list[current.id] = current;
        for(let key in Object.keys(current)){
            if (current[key] == undefined){
                continue;
            }
            queue.push(current[key]);
        }
    }
    return list; 
}

function dfs(node, path){
    if (node == undefined){
        return undefined;
    }
    if((node.flags && "isExternal" in node.flags && node.flags.isExternal)){
        return undefined;
    }
    path.push(node.name);
    const res = Object.create(node);
    res.path = [...path];
    const categories = getCategoryStrings(res);
    const groups = getGroups(res);
    if(categories){
        res.categories = categories;
    }
    if(groups && groups.length > 0){
        res.groups = groups;
    }
    if (node.children == undefined){
        return res;
    }
    for (let child of node.children){
        res[child.name] = dfs(child, [...path]);
    }
    if (res.signatures){
        res.signatures.forEach((signature)=>{
            res[signature.name] = dfs(signature, [...path]);
        });
    }
    if(res.getSignature){
        res[getSignature.name] = dfs(res.getSignature, [...path]);
    }
    if(res.setSignature){
        res[setSignature.name] = dfs(res.setSignature, [...path]);
    }
    return res;
}

export function getCategoryStrings(node){
    if (node.categories){
        return node.categories.map((category, index) => {
            const translationJSONPath = [`${node.id}`, `categories`, `index-${index}`];
            const projectPath = [...node.path, "categories", `index-${index}`, "title"];
            const translationKey = crypto.createHash('md5').update(`${projectPath.join("")}${category.title}${"category"}`).digest('hex');
            const locationIdentifier = crypto.createHash('md5').update(`${translationJSONPath.join("")}${category.title}${"category"}`).digest('hex');
            const item = { translationKey: translationKey, translationJSONPath: translationJSONPath, projectPath: projectPath, originalText: category.title, translation: "", kind: "category", locationIdentifier: locationIdentifier};
            return item;
        });
    }
    return undefined;
}

export function getGroups(node){
    if(node.groups){
        let items = node.groups.map((group, index) => {
            const projectPath = [...node.path, "groups", `index-${index}`, "title"];
            const translationJSONPath = [];
            translationJSONPath.push(`${node.id}`);
            translationJSONPath.push("groups");
            translationJSONPath.push(`index-${index}`);
            const translationKey = crypto.createHash('md5').update(`${projectPath.join("")}${group.title}${"group"}`).digest('hex');
            const locationIdentifier = crypto.createHash('md5').update(`${translationJSONPath.join("")}${group.title}${"group"}`).digest('hex');
            const item = { translationKey: translationKey, translationJSONPath: translationJSONPath, projectPath: projectPath, originalText: group.title, translation: "", kind: "group", locationIdentifier: locationIdentifier};
            return item;
        });
        items = items.filter((item)=>{
            return !(item.originalText in constantGroup);
        });
        return items.map((item, index)=>{
            item.translationJSONPath.push(`index-${index}`);
            item.locationIdentifier = crypto.createHash('md5').update(`${item.translationJSONPath.join("")}${item.originalText}${"group"}`).digest('hex');
            return {...item};
        });
    }
    return undefined;
}
