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
    const flatList = {};
    const tree = {"@niuee/board": dfs(dataNode, [], flatList)};
    const flattened = flatten(tree["@niuee/board"]);
    writeFileSync(resolve("scripts/util/testdata", "tree.json"), JSON.stringify(tree, null, 2));
    writeFileSync(resolve("scripts/util/testdata", "flattened.json"), JSON.stringify(flatList, null, 2));
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

function dfs(node, path, flatList){
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
    const comments = getComment(res);
    const groups = getGroups(res);

    if(categories){
        res.categories = categories;
    }
    if(comments && comments.length > 0){
        res.comments = comments;
    }
    if((groups && groups.length > 0) || (categories && categories.length > 0) || (comments.length > 0)){
        flatList[res.id] = {
            path: res.path,
            name: res.name,
            kind: reflectionMapping(res),
            id: res.id,
            categories: res.categories,
            groups: groups,
            comments: res.comments,
        };
    }
    // if (node.children == undefined){
    //     return res;
    // }
    if(res.children){
        for (let child of res.children){
            res[child.name] = dfs(child, [...path], flatList);
        }
    }
    if (res.signatures){
        res.signatures.forEach((signature)=>{
            res[signature.name] = dfs(signature, [...path], flatList);
        });
    }
    if(res.getSignature){
        res[res.getSignature.name] = dfs(res.getSignature, [...path], flatList);
    }
    if(res.setSignature){
        res[res.setSignature.name] = dfs(res.setSignature, [...path], flatList);
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

function getComment(node){
    const res = [];
    if(node.comment){
        if(node.comment.summary == undefined){
            node.comment.summary = [];
        }
        if(node.comment.blockTags){
            node.comment.blockTags.forEach((comment)=>{
                if(comment.tag !== "@translation"){
                    return;
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
                    item.projectPath = [...node.path, "comment", "summary",`index-${insertAtSummary}`, "text"];
                    node.comment.summary.push(content);
                    item.kind = reflectionMapping(node);
                    const locationIdentifier = crypto.createHash('md5').update(`${item.translationJSONPath.join("")}${item.originalText}${item.kind}`).digest('hex');
                    item.translationKey = crypto.createHash('md5').update(`${item.projectPath.join("")}${item.originalText}${item.kind}`).digest('hex');
                    item.locationIdentifier = locationIdentifier;
                    res.push(item);
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
    return res;
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
