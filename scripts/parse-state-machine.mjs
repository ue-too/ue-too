import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const traverse = traverseModule.default || traverseModule;

function generateConditionSource(node) {
    if (node.type === 'BinaryExpression') {
        const left = generateConditionSource(node.left);
        const right = generateConditionSource(node.right);
        return `${left} ${node.operator} ${right}`;
    }
    if (node.type === 'LogicalExpression') {
        const left = generateConditionSource(node.left);
        const right = generateConditionSource(node.right);
        return `${left} ${node.operator} ${right}`;
    }
    if (node.type === 'CallExpression') {
        return `${node.callee.type === 'MemberExpression' ? `${node.callee.object.name}.${node.callee.property.name}` : node.callee.name}(${node.arguments.map(arg => getReturnValue(arg, imports)).join(', ')})`;
    }
    if (node.type === 'Identifier') {
        return node.name;
    }
    return null;
}

function getReturnValue(node, imports) {
    if (!node) return null;
    
    switch (node.type) {
        case 'StringLiteral':
            return node.value;
        case 'Identifier':
            return node.name;
        case 'MemberExpression':
            return `${node.object.type === 'ThisExpression' ? 'this' : node.object.name}.${node.property.name}`;
        case 'CallExpression':
            return `${node.callee.name}(${node.arguments.map(arg => getReturnValue(arg, imports)).join(', ')})`;
        case 'TSTypeReference':
            return imports[node.typeName.name] || node.typeName.name;
        default:
            return null;
    }
}

async function analyzeFile(filePath) {
    try {
        const fullPath = resolve(filePath);
        const code = readFileSync(fullPath, 'utf-8');
        return analyzeConditionalReturns(code, fullPath);
    } catch (error) {
        throw new Error(`Error analyzing file ${filePath}: ${error.message}`);
    }
}


function analyzeConditionalReturns(code, filePath = 'anonymous.ts') {
    const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'classProperties'],
        sourceFilename: filePath
    });

    const results = {
        file: filePath,
        methods: new Map()
    };

    const imports = {}; // Store imported types

    traverse(ast, {
        ImportDeclaration(path) {
            path.node.specifiers.forEach(specifier => {
                imports[specifier.local.name] = specifier.imported.name; // Map imported names
            });
        },
        ClassMethod(path) {
            const methodName = path.node.key.name;
            const returns = [];

            path.traverse({
                ReturnStatement(returnPath) {
                    const returnNode = returnPath.node;
                    const parentPath = returnPath.parentPath;

                    // Handle different types of returns
                    if (returnNode.argument?.type === 'ConditionalExpression') {
                        // Ternary return
                        returns.push({
                            line: returnNode.loc.start.line,
                            type: 'ternary',
                            condition: generateConditionSource(returnNode.argument.test),
                            whenTrue: returnNode.argument.consequent.value,
                            whenFalse: returnNode.argument.alternate.value,
                            sourceFile: filePath
                        });
                    } else if (parentPath.type === 'BlockStatement' && 
                             parentPath.parentPath.type === 'IfStatement') {
                        // Return within if statement - already handled by IfStatement visitor
                    } else {
                        // Direct return (not in a condition)
                        returns.push({
                            line: returnNode.loc.start.line,
                            type: 'direct',
                            value: getReturnValue(returnNode.argument, imports), // Pass imports
                            sourceFile: filePath
                        });
                    }
                },

                IfStatement(ifPath) {
                    const ifNode = ifPath.node;
                    console.log("If Node:", ifNode);
                    console.log("If Node Test:", ifNode.test);
                    const returnInfo = {
                        line: ifNode.loc.start.line,
                        type: 'if',
                        condition: generateConditionSource(ifNode.test),
                        returns: [],
                        sourceFile: filePath
                    };

                    ifPath.traverse({
                        ReturnStatement(returnPath) {
                            const returnValue = returnPath.node.argument;

                            // Debugging: Log the return value node
                            console.log("Return Value Node:", returnValue);

                            if (returnValue.type === 'CallExpression') {
                                returnInfo.returns.push({
                                    state: getReturnValue(returnValue, imports),
                                    condition: returnInfo.condition
                                });
                            } else {
                                returnInfo.returns.push({
                                    state: getReturnValue(returnValue, imports),
                                    condition: returnInfo.condition
                                });
                            }
                        }
                    });

                    // Debugging: Log the return info
                    console.log("Return Info:", returnInfo);

                    returns.push(returnInfo);
                },

                SwitchStatement(switchPath) {
                    console.log("switch statement");
                    const switchNode = switchPath.node;
                    const returnInfo = {
                        line: switchNode.loc.start.line,
                        type: 'switch',
                        cases: [],
                        sourceFile: filePath
                    };

                    switchPath.traverse({
                        ReturnStatement(returnPath) {
                            console.log("return statement in switch");
                            returnInfo.cases.push({
                                state: getReturnValue(returnPath.node.argument, imports), // Pass imports
                                condition: returnInfo.condition
                            });
                        }
                    });

                    // Store the switch return information
                    console.log("returnInfo", returnInfo);
                    returns.push(returnInfo);
                }
            });

            if (returns.length > 0) {
                results.methods.set(methodName, returns);
            }
        }
    });

    return results;
}

function printAnalysis(results) {
    console.log(`\nAnalysis for file: ${results.file}`);
    console.log('----------------------------------------');
    
    for (const [method, returns] of results.methods) {
        console.log(`\nMethod: ${method}`);
        returns.forEach((ret) => {
            console.log(`  Line ${ret.line}:`);
            switch (ret.type) {
                case 'ternary':
                    console.log(`    Type: Ternary`);
                    console.log(`    Condition: ${ret.condition}`);
                    console.log(`    When true: ${ret.whenTrue}`);
                    console.log(`    When false: ${ret.whenFalse}`);
                    break;
                case 'if':
                    console.log(`    Type: If Statement`);
                    console.log(`    Condition: ${ret.condition}`);
                    ret.returns.forEach(r => {
                        console.log(`    Returns "${r.state}" when: ${r.condition}`);
                    });
                    break;
                case 'direct':
                    console.log(`    Type: Direct Return`);
                    console.log(`    Returns: ${ret.value}`);
                    break;
            }
        });
    }
}

// Example usage
async function main() {
    try {
        const results = await analyzeFile('./src/input-state-machine/touch-state-machine.ts');
        printAnalysis(results);
    } catch (error) {
        console.error('Analysis failed:', error.message);
    }
}

main();

export { analyzeFile, analyzeConditionalReturns, printAnalysis };
