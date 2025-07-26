import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Get all package.json files in dist folders
function getDistPackageJsonFiles() {
  const packages = readdirSync('packages', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => join('packages', dirent.name, 'dist', 'package.json'))
    .filter(path => existsSync(path));
  
  const apps = readdirSync('apps', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => join('apps', dirent.name, 'dist', 'package.json'))
    .filter(path => existsSync(path));
  
  return [...packages, ...apps];
}

// Read package.json and get version
function getPackageVersion(packagePath) {
  try {
    const content = readFileSync(packagePath, 'utf8');
    const pkg = JSON.parse(content);
    return pkg.version;
  } catch (error) {
    console.warn(`Could not read version from ${packagePath}:`, error.message);
    return null;
  }
}

// Replace workspace dependencies with actual versions in dist package.json files
function replaceWorkspaceDepsInDist(packagePath) {
  try {
    const content = readFileSync(packagePath, 'utf8');
    const pkg = JSON.parse(content);
    let modified = false;
    
    // Check dependencies
    if (pkg.dependencies) {
      for (const [dep, version] of Object.entries(pkg.dependencies)) {
        if (version === 'workspace:*') {
          const depPackagePath = dep.startsWith('@ue-too/') 
            ? join('packages', dep.replace('@ue-too/', ''), 'package.json')
            : dep.startsWith('@mono/')
            ? join('apps', dep.replace('@mono/', ''), 'package.json')
            : null;
          
          if (depPackagePath) {
            const depVersion = getPackageVersion(depPackagePath);
            if (depVersion) {
              pkg.dependencies[dep] = `^${depVersion}`;
              modified = true;
              console.log(`Updated ${dep} from workspace:* to ^${depVersion} in ${packagePath}`);
            }
          }
        }
      }
    }
    
    // Check devDependencies
    if (pkg.devDependencies) {
      for (const [dep, version] of Object.entries(pkg.devDependencies)) {
        if (version === 'workspace:*') {
          const depPackagePath = dep.startsWith('@ue-too/') 
            ? join('packages', dep.replace('@ue-too/', ''), 'package.json')
            : dep.startsWith('@mono/')
            ? join('apps', dep.replace('@mono/', ''), 'package.json')
            : null;
          
          if (depPackagePath) {
            const depVersion = getPackageVersion(depPackagePath);
            if (depVersion) {
              pkg.devDependencies[dep] = `^${depVersion}`;
              modified = true;
              console.log(`Updated ${dep} from workspace:* to ^${depVersion} in ${packagePath}`);
            }
          }
        }
      }
    }
    
    if (modified) {
      writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    }
    
    return modified;
  } catch (error) {
    console.error(`Error processing ${packagePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('Replacing workspace dependencies with actual versions in dist folders...');
const distPackageFiles = getDistPackageJsonFiles();

if (distPackageFiles.length === 0) {
  console.log('No dist folders found. Please build packages first using: pnpm build');
  process.exit(1);
}

let totalModified = 0;

for (const packagePath of distPackageFiles) {
  if (replaceWorkspaceDepsInDist(packagePath)) {
    totalModified++;
  }
}

console.log(`\nCompleted! Modified ${totalModified} package.json files in dist folders.`); 