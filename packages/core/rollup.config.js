import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import alias from '@rollup/plugin-alias';
import path from 'path';
import fs from 'fs';
const packageJson = require("./package.json");


const plugins = [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      exclude: ["node_modules", "dist", "build", "devserver/**/*", "tests/**/*"],
    }),
    terser({
      mangle: false,
    }),
]

const pluginsWithDeclaration = [
    resolve(),
    typescript({
      tsconfig: "./tsconfig.json",
      exclude: ["node_modules", "dist", "build", "devserver/**/*", "tests/**/*"],
      declaration: true,
      outDir: './build',
      // Add outDir for declaration generation
    }),
    terser({
      mangle: true,
    }),
]

const pluginsNoTerser = [
    // alias({
    //   entries: [
    //     { find: 'src', replacement: path.resolve(__dirname, 'src') }
    //   ]
    // }),
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      exclude: ["node_modules", "dist", "build", "devserver/**/*", "tests/**/*"],
      outDir: 'dist',
      // Remove outDir to avoid conflict with rollup output paths
    }),
]

const getComponentsFoldersRecursive = (entry) => {
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
    ],
    external: [
      'point2point',
    ],
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
      name: 'ue-too',
      sourcemap: true,
    },
    {
      file: packageJson.module,
      format: 'esm',
      name: 'ue-too',
      sourcemap: true
    }
    ],
    plugins: [
        ...pluginsWithDeclaration,
    ],
    external: ['point2point'],
  },
  {
    // distribution for direct browser usage
    input: 'src/index.ts',
    output: [
    {
      file: 'dist/ue-too.js',
      format: 'esm',
      name: 'ue-too',
      sourcemap: true,
    },
    ],
    plugins: [
        ...pluginsNoTerser,
    ],
  }
];
