// rollup.config.js
import typescript from '@rollup/plugin-typescript';
// import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";
import generatePackageJson from 'rollup-plugin-generate-package-json';

const packageJson = require("./package.json");



const fs = require('fs');

const plugins = [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      // useTsconfigDeclarationDir: true,
    }),
    terser({
      mangle: false,
    }),
]

export const getComponentsFolders = (entry) => {
   const dirs = fs.readdirSync(entry)
   const dirsWithoutIndex = dirs.filter(name => name !== 'index.ts' && name !== 'utils')
   return dirsWithoutIndex
};

const folderBuilds = getComponentsFolders('./src').map((folder) => {
  return {
    input: `src/${folder}/index.ts`,
    output: [
    {
      file: `build/${folder}/index.js`,
      sourcemap: true,
      format: 'esm',
    },
    ],
    plugins: [
        ...plugins,
        
    ]
  };
});

const packageJsonFile = getComponentsFolders('./src').map((folder) => {
  return {
    input: `src/${folder}/index.ts`,
    output: {
      file: `build/${folder}/cjs/index.js`,
      sourcemap: true,
      format: 'cjs',
    },
    plugins: [
      resolve(),
      typescript(),
      generatePackageJson({
        outputFolder: `build/${folder}`,
        baseContents: {
          name: `${packageJson.name}/${folder}`,
          private: true,
          main: "./cjs/index.js", // --> points to cjs format entry point of whole library
          module: "./esm/index.js", // --> points to esm format entry point of individual component
          types: "./index.d.ts", // --> points to types definition file of individual component
        },
     }),
    ],
  };
});

const types = getComponentsFolders('./src').map((folder) => {
  return {
    input: `src/${folder}/index.ts`,
    output: {
      file: `build/${folder}/index.d.ts`,
      format: "es",
    },
    plugins: [
      dts.default(),
    ],
  };

});
// folderBuilds.push(...types);


// console.log(folderBuilds);

export default [
  ...folderBuilds,
  // ...types,
  // ...packageJsonFile,
  {
    input: 'src/index.ts',
    output: [{
      file: packageJson.main,
      format: 'cjs',
      name: '@niuee/vcanvas',
      sourcemap: true,
    },  
    {
      file: packageJson.module,
      format: 'esm',
      name: '@niuee/vcanvas',
      sourcemap: true
    }
    ],
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: "./build",
      }),
      terser({
        mangle: false,
      }),
    ],
  },
  {
    // distribution for direct browser usage
    input: 'src/index.ts',
    output: {
      file: 'dist/vcanvas.js',
      format: 'esm',
      name: 'vcanvas',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser({
        mangle: false,
      }),
    ],
  }
];