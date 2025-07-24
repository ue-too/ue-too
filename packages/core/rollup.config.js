import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tsconfig = path.resolve(__dirname, 'tsconfig.lib.json');

const plugins = [
    resolve(),
    typescript({
      tsconfig,
      declaration: false,
    }),
    terser({
      mangle: false,
    }),
]

const pluginsWithDeclaration = [
    resolve(),
    typescript({
      tsconfig,
      declaration: true,
      declarationDir: './build',
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
      tsconfig,
      declaration: false,
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
        finalListOfDirs.push(dir);   
        const subDirs = fs.readdirSync(path.resolve(entry, dir));
        dirs.push(...subDirs.map(subDir => path.join(dir, subDir)));
      }
    }
  } 
  return finalListOfDirs;
};

console.log(getComponentsFoldersRecursive(path.resolve(__dirname, 'src')));

const folderBuilds = getComponentsFoldersRecursive(path.resolve(__dirname, 'src')).map((folder) => {
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
  // ...folderBuilds,
  // the overarching package build
  // {
  //   input: 'src/index.ts',
  //   output: [{
  //     file: packageJson.main,
  //     format: 'cjs',
  //     name: 'ue-too',
  //     sourcemap: true,
  //   },
  //   {
  //     file: packageJson.module,
  //     format: 'esm',
  //     name: 'ue-too',
  //     sourcemap: true
  //   }
  //   ],
  //   plugins: [
  //       ...pluginsWithDeclaration,
  //   ],
  //   external: ['point2point'],
  // },
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      }
    ],
    plugins: [
      resolve(),
      typescript({
        tsconfig: path.join(__dirname, 'tsconfig.lib.json'),
        declaration: true,
        declarationDir: path.join(__dirname, 'build'),
      }),
      terser(),
    ],
    external: [],
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
