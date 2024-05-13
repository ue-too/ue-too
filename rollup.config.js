// rollup.config.js
import typescript from '@rollup/plugin-typescript';
// import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import path from 'path';
const packageJson = require("./package.json");


const fs = require('fs');

const plugins = [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
    }),
    terser({
      mangle: false,
    }),
]

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
    // {
    //   file: `build/${folder}/index.cjs`,
    //   sourcemap: true,
    //   format: 'cjs',
    // }
    ],
    plugins: [
        ...plugins,
    ]
  };
});

export default [
  ...folderBuilds,
  // the overarching package build
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
      typescript(),
      terser({
        mangle: true,
      }),
    ],
  },
  {
    // distribution for direct browser usage
    input: 'src/index.ts',
    output: [
    {
      file: 'dist/board.js',
      format: 'esm',
      name: 'board',
      sourcemap: true,
    },
    {
      file: 'build/umd/index.js',
      format: 'umd',
      name: "Board",
      sourcemap: true
    },
    {
      file: 'build/iife/index.js',
      format: 'iife',
      name: "Board",
      sourcemap: true
    }
    ],
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
