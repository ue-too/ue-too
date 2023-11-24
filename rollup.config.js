// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";

const packageJson = require("./package.json");

export default [{
  input: 'src/index.ts',
  output: [//{
  //   file: packageJson.main,
  //   format: 'cjs',
  //   name: 'YourLibrary',
  //   sourcemap: true,
  // },  
  {
    file: packageJson.module,
    format: 'esm',
    name: 'YourLibrary',
    sourcemap: true,
  }
  ],
  plugins: [
    typescript(),
    resolve(),
    terser(),
  ],
},
{
    input: "src/index.ts",
    output: [{ file: "build/types.d.ts", format: "es" }],
    plugins: [dts.default()],
  } 
];