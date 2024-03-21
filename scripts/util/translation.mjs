import crypto from "crypto";
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

export function injectTranslation(tree, translationObject){
    const keys = Object.keys(translationObject);
    for (let key of keys){
        const item = translationObject[key];
        const targetNode = getByPathShort(tree, item.projectPath);
        const finalProperty = item.projectPath[item.projectPath.length - 1];
        const originalText = getByPath(tree, item.projectPath);
        if(targetNode == undefined || originalText !== item.originalText){
            console.log("This translation item is either changed place or removed or having a different original text; please revise the translation", item);
        } else {
            if(item.translation !== ""){
                targetNode[finalProperty] = item.translation;
            }
        }
    }
    return tree;
}

export function parseRawTranslation(tree, translationObject){
    const keys = Object.keys(translationObject);
    const discrepencies = [];
    for (let key of keys){
        const item = translationObject[key];
        const targetNode = getByPathShort(tree, item.projectPath);
        const originalText = getByPath(tree, item.projectPath);
        if(targetNode == undefined || originalText !== item.originalText){
            if(targetNode == undefined){
                console.log("This translation item is removed; please remove it from the translation file", item);
            } else {
                console.log("The original text is different");
                console.log("original text:", originalText);
            }
            discrepencies.push(item);
            console.log("This translation item either changed place or removed or the original text is different; please revise the translation", item);
        }
    }
    return discrepencies;
}

export function parse(dataNode){
    const flatList = {};
    const structure = {};
    const tree = {"@niuee/board": dfs(dataNode, ["@niuee/board"], flatList, structure)};
    const translationItems = getTranslationItem(flatList);
    const translationObject = getTranslationItemsAsObject(flatList);
    return {tree: tree, flatList: flatList, translationItems: translationItems, translationObject: translationObject, structure: structure};
}

export function getTranslationItem(flatList){
    const res = [];
    for (let key of Object.keys(flatList)){
        const item = flatList[key];
        if (item.categories !== undefined && item.categories.length > 0){
            res.push(...item.categories);
        }
        if (item.groupList !== undefined && item.groupList.length > 0){
            res.push(...item.groupList);
        }
        if (item.comments !== undefined && item.comments.length > 0){
            res.push(...item.comments);
        }
    }
    return res;
}

export function getTranslationItemsAsObject(flatList){
    const res = {};
    for (let key of Object.keys(flatList)){
        const item = flatList[key];
        if (item.categories !== undefined && item.categories.length > 0){
            item.categories.forEach((category)=>{
                res[category.translationKey] = {
                    translationKey: category.translationKey,
                    projectPath: category.projectPath,
                    flatPath: category.flatPath,
                    belongsTo: item.name,
                    kind: "category",
                    originalText: category.originalText,
                    translation: "",
                };
            });
        }
        if (item.groups !== undefined && item.groups.length > 0){
            item.groups.forEach((group)=>{
                res[group.translationKey] = {
                    translationKey: group.translationKey,
                    projectPath: group.projectPath,
                    translationJSONPath: group.translationJSONPath,
                    belongsTo: item.name,
                    kind: "group",
                    originalText: group.originalText,
                    translation: "",
                };
            });
        }
        if (item.comments !== undefined && item.comments.length > 0){
            item.comments.forEach((comment)=>{
                res[comment.translationKey] = {
                    translationKey: comment.translationKey,
                    projectPath: comment.projectPath,
                    translationJSONPath: comment.translationJSONPath,
                    name: item.name,
                    kind: item.kind,
                    originalText: comment.originalText,
                    translation: "",
                };
            });
        }
    }
    return res;
}

export function flatten(node){
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

export function dfs(node, path, flatList, structure){
    if (node == undefined){
        return undefined;
    }
    if((node.flags && "isExternal" in node.flags && node.flags.isExternal)){
        return undefined;
    }
    // path.push(node.id.toString());
    const res = Object.create(node);
    res.path = [...path];

    const categories = getCategoryStrings(res);
    const comments = getComment(res);
    const groupList = getGroups(res);

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

    if((groupList && groupList.length > 0) || (categories && categories.length > 0) || (comments.length > 0)){
        flatList[res.id.toString()] = {
            path: res.path,
            name: res.name,
            kind: reflectionMapping(res),
            id: res.id,
            categories: categories,
            groups: groupList,
            comments: comments,
        };
    }

    if(res.children){
        for (let child of res.children){
            path.push(child.name);
            res[child.name] = dfs(child, [...path], flatList, structure);
            path.pop();
        }
    }
    if (res.signatures){
        res.signatures.forEach((signature)=>{
            path.push(signature.name);
            res[signature.name] = dfs(signature, [...path], flatList, structure);
            path.pop();
        });
    }
    if(res.getSignature){
        path.push("getSignature");
        res["getSignature"] = dfs(res.getSignature, [...path], flatList, structure);
        path.pop();
    }
    if(res.setSignature){
        path.push("setSignature");
        res["setSignature"] = dfs(res.setSignature, [...path], flatList, structure);
        path.pop();
    }
    return res;
}

export function getCategoryStrings(node){
    if (node.categories){
        return node.categories.map((category, index) => {
            const flatPath = [`${node.id}`, `categories`, `index-${index}`];
            const projectPath = [...node.path, "categories", `index-${index}`, "title"];
            const translationKey = crypto.createHash('md5').update(`${projectPath.join("")}${category.title}${"category"}`).digest('hex');
            const locationIdentifier = crypto.createHash('md5').update(`${flatPath.join("")}${category.title}${"category"}`).digest('hex');
            const item = { translationKey: translationKey, flatPath: flatPath, projectPath: projectPath, originalText: category.title, translation: "", kind: "category", locationIdentifier: locationIdentifier};
            return item;
        });
    }
    return undefined;
}

export function getGroups(node){
    if(node.groups){
        let items = node.groups.map((group, index) => {
            const projectPath = [...node.path, "groups", `index-${index}`, "title"];
            const flatPath = [];
            flatPath.push(`${node.id}`);
            flatPath.push("groups");
            flatPath.push(`index-${index}`);
            const translationKey = crypto.createHash('md5').update(`${projectPath.join("")}${group.title}${"group"}`).digest('hex');
            const locationIdentifier = crypto.createHash('md5').update(`${flatPath.join("")}${group.title}${"group"}`).digest('hex');
            const item = { translationKey: translationKey, flatPath: flatPath, projectPath: projectPath, originalText: group.title, translation: "", kind: "group", locationIdentifier: locationIdentifier};
            return item;
        });
        items = items.filter((item)=>{
            return !(item.originalText in constantGroup);
        });
        return items.map((item, index)=>{
            item.flatPath.push(`index-${index}`);
            item.locationIdentifier = crypto.createHash('md5').update(`${item.flatPath.join("")}${item.originalText}${"group"}`).digest('hex');
            return {...item};
        });
    }
    return undefined;
}

export function getComment(node){
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
                    item.flatPath = [];
                    item.flatPath.push(`${node.id}`);
                    item.flatPath.push(`${node.name}`);
                    item.flatPath.push("comments");
                    item.flatPath.push(`index-${index}`);
                    const insertAtSummary = node.comment.summary.length;
                    item.projectPath = [...node.path, "comment", "summary",`index-${insertAtSummary}`, "text"];
                    node.comment.summary.push(content);
                    item.kind = reflectionMapping(node);
                    const locationIdentifier = crypto.createHash('md5').update(`${item.flatPath.join("")}${item.originalText}${item.kind}`).digest('hex');
                    item.translationKey = crypto.createHash('md5').update(`${item.projectPath.join("")}${item.originalText}${item.kind}`).digest('hex');
                    item.locationIdentifier = locationIdentifier;
                    res.push(item);
                });
            });
            node.comment.blockTags = node.comment.blockTags.filter((comment)=>{
                return comment.tag !== "@translation";
            });
            node.comment.blockTags.forEach((comment, blockTagIndex)=>{
                if(comment.tag !== "@translationBlock"){
                    return;
                }
                comment.content.forEach((content, index)=>{
                    if(content.kind !== "text"){
                        return;
                    }
                    const item = {};
                    item.originalText = content.text;
                    item.translation = "";
                    item.flatPath = [];
                    item.flatPath.push(`${node.id}`);
                    item.flatPath.push(`${node.name}`);
                    item.flatPath.push("comments");
                    item.flatPath.push(`index-${index}`);
                    item.projectPath = [...node.path, "comment", "blockTags",`index-${blockTagIndex}`, "content", `index-${index}`, "text"];
                    item.kind = reflectionMapping(node);
                    const locationIdentifier = crypto.createHash('md5').update(`${item.flatPath.join("")}${item.originalText}${item.kind}`).digest('hex');
                    item.translationKey = crypto.createHash('md5').update(`${item.projectPath.join("")}${item.originalText}${item.kind}`).digest('hex');
                    item.locationIdentifier = locationIdentifier;
                    res.push(item);
                });
                comment.tag = "";
            });
        }
    }
    return res;
}

export function reflectionMapping(node){
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

export function getByPath(root, path){
    let obj = root;
    for(let index = 0; index < path.length; index++){
        if(obj === undefined){
            console.error("Path not found", path);
            return undefined;
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

export function getByPathShort(root, path){
    let obj = root;
    for(let index = 0; index < path.length - 1; index++){
        if(obj === undefined){
            console.error("Path not found", path);
            return undefined;
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
