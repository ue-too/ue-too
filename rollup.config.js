// rollup.config.js
import typescript from '@rollup/plugin-typescript';
// import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";
import generatePackageJson from 'rollup-plugin-generate-package-json';
import path from 'path';
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

export const getComponentsFoldersRecursive = (entry) => {
  const finalListOfDirs = [];
  const dirs = fs.readdirSync(entry)
  while (dirs.length !== 0){
    const length = dirs.length;
    for(let i=0; i < length; i++){
      const dir = dirs.shift();
      if(fs.statSync(path.resolve(entry, dir)).isDirectory()){
        if (entry === './src') {
          finalListOfDirs.push(dir);   
        } else {
          finalListOfDirs.push(path.join(entry, dir));
        }
        const subDirs = fs.readdirSync(path.resolve(entry, dir));
        dirs.push(...subDirs.map(subDir => path.join(dir, subDir)));
      }
    }
  } 
  return finalListOfDirs;
};

console.log(getComponentsFoldersRecursive('./src'));


const folderBuilds = getComponentsFoldersRecursive('./src').map((folder) => {
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

const types = getComponentsFoldersRecursive('./src').map((folder) => {
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
      name: '@niuee/board',
      sourcemap: true,
    },  
    {
      file: packageJson.module,
      format: 'esm',
      name: '@niuee/board',
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
      file: 'dist/board.js',
      format: 'esm',
      name: 'board',
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