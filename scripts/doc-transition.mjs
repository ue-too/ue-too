import {cpSync, readdirSync, statSync} from "node:fs";
import {resolve} from "node:path";

const l10nCode = process.argv[2];
try{
    if (!l10nCode) {
        cpSync(resolve("./", "docs-staging/en"), resolve("./", "docs/"), {recursive: true});
        const files = readdirSync(resolve("./", "doc-jsons/staging"));
        for (const file of files) {
            if(statSync(resolve("./", "doc-jsons/staging", file)).isDirectory()) continue;
            cpSync(resolve("./", "doc-jsons/staging", file), resolve("./", "doc-jsons/prod", file), {recursive: false});
        }
    } else {
        cpSync(resolve("./", `docs-staging/${l10nCode}`), resolve("./", `docs/${l10nCode}`), {recursive: true});
        cpSync(resolve("./", `doc-jsons/staging/${l10nCode}`), resolve("./", `doc-jsons/prod/${l10nCode}`), {recursive: true});
    }
} catch (e) {
    console.log("There is an error moving the docs for:", l10nCode == null ? "en" : l10nCode);
    console.log(e);
}