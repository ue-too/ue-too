/**
 * Builds TypeDoc documentation for all supported locales.
 *
 * Usage: bun run ../../scripts/docs-build-i18n.ts
 *
 * Reads the package's typedoc.json, extracts the output directory,
 * and runs TypeDoc once per locale with the appropriate --lang and --out flags.
 *
 * For locales not built into TypeDoc (e.g., zh-TW), custom translations
 * are loaded from typedoc-locales/<locale>.json and passed via a temporary
 * config file that extends the package's typedoc.json.
 *
 * If a package has a docs/<locale>/ directory (e.g., docs/en/, docs/zh-TW/),
 * markdown files within it are included via TypeDoc's projectDocuments option.
 *
 * Output structure: docs/<locale>/<package>/
 * e.g., docs/en/math/, docs/zh-TW/math/, docs/ja/math/
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { basename, resolve } from "path";

const LOCALES = ["en", "zh-TW", "ja"];

// TypeDoc built-in locales — anything not in this set needs a custom locale file
const TYPEDOC_BUILTIN_LOCALES = new Set(["en", "zh", "ja", "ko", "de"]);

const scriptDir = import.meta.dirname;
const projectRoot = resolve(scriptDir, "..");

const typedocConfigPath = resolve(process.cwd(), "typedoc.json");
if (!existsSync(typedocConfigPath)) {
    console.error(`No typedoc.json found in ${process.cwd()}`);
    process.exit(1);
}

const config = JSON.parse(readFileSync(typedocConfigPath, "utf-8"));
const baseOut: string = config.out;
if (!baseOut) {
    console.error("No 'out' field found in typedoc.json");
    process.exit(1);
}

// Extract the package directory name from the out path (e.g., "../../docs/math" -> "math")
const packageDir = basename(baseOut);
const docsRoot = resolve(process.cwd(), baseOut, "..");

for (const locale of LOCALES) {
    const outDir = resolve(docsRoot, locale, packageDir);

    // Clean previous output
    if (existsSync(outDir)) {
        rmSync(outDir, { recursive: true });
    }

    console.log(`Building docs for locale: ${locale} -> ${outDir}`);

    let optionsFile = "typedoc.json";
    let tempConfigPath: string | undefined;

    const localeDocsDir = resolve(process.cwd(), "docs", locale);
    const hasLocaleDocs = existsSync(localeDocsDir);
    const needsCustomLocale = !TYPEDOC_BUILTIN_LOCALES.has(locale);
    const needsTempConfig = hasLocaleDocs || needsCustomLocale;

    if (needsTempConfig) {
        const tempConfig: Record<string, unknown> = {
            extends: "./typedoc.json",
        };

        if (hasLocaleDocs) {
            tempConfig.projectDocuments = [`docs/${locale}/**/*.md`];
        }

        if (needsCustomLocale) {
            const localeFilePath = resolve(
                projectRoot,
                "typedoc-locales",
                `${locale}.json`,
            );
            if (!existsSync(localeFilePath)) {
                console.error(
                    `Custom locale file not found: ${localeFilePath}`,
                );
                process.exit(1);
            }

            const translations = JSON.parse(
                readFileSync(localeFilePath, "utf-8"),
            );
            tempConfig.locales = { [locale]: translations };
        }

        tempConfigPath = resolve(
            process.cwd(),
            `.typedoc-i18n-${locale}.json`,
        );
        writeFileSync(tempConfigPath, JSON.stringify(tempConfig));
        optionsFile = tempConfigPath;
    }

    const proc = Bun.spawnSync(
        [
            "bun",
            "run",
            "typedoc",
            "--options",
            optionsFile,
            "--skipErrorChecking",
            "--lang",
            locale,
            "--out",
            outDir,
        ],
        {
            cwd: process.cwd(),
            stdout: "inherit",
            stderr: "inherit",
        },
    );

    // Clean up temporary config
    if (tempConfigPath && existsSync(tempConfigPath)) {
        rmSync(tempConfigPath);
    }

    if (proc.exitCode !== 0) {
        console.error(`Failed to build docs for locale: ${locale}`);
        process.exit(proc.exitCode ?? 1);
    }
}

console.log("All locale docs built successfully.");
