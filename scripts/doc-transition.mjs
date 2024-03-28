import {cpSync, readdirSync, statSync} from "node:fs";
import {resolve} from "node:path";

const l10nCode = process.argv[2];
try{
    if (!l10nCode) {
        cpSync(resolve("./", "docs-staging/en"), resolve("./", "docs/"), {recursive: true});
        // cpSync(resolve("./", `translations/staging/en`), resolve("./", `translations/prod/en`), {recursive: true});
    } else {
        cpSync(resolve("./", `docs-staging/${l10nCode}`), resolve("./", `docs/${l10nCode}`), {recursive: true});
        cpSync(resolve("./", `translations/staging/${l10nCode}`), resolve("./", `translations/prod/${l10nCode}`), {recursive: true});
    }
} catch (e) {
    console.log("There is an error moving the docs for:", l10nCode == null ? "en" : l10nCode);
    console.log(e);
}