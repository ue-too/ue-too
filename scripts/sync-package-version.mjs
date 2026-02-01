import { writeFileSync } from 'fs';

import mainData from '../package.json' with { type: 'json' };

console.log(`Current version: ${mainData.version}`);
console.log(`Passed In Version: ${process.argv[2]}`);
const [targetMajorVersion, targetMinorVersion, targetPatchVersion] =
    process.argv[2].split('.');
mainData.version = `${targetMajorVersion}.${targetMinorVersion}.${targetPatchVersion}`;

writeFileSync('./package.json', JSON.stringify(mainData, null, 2));
