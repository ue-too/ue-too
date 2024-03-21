import {Converter, TypeScript, Application, Renderer,ProjectReflection, ReflectionGroup} from "typedoc";

export const load = function ({ application, options }) {
    /** @type {Map<Reflection, string>} */
    const defaultValues = new Map();

    const printer = TypeScript.createPrinter({
        removeComments: true,
        omitTrailingSemicolon: true,
    });

    application.converter.on(
        Converter.EVENT_CREATE_DECLARATION,
        saveDefaultValues
    );
    application.converter.on(
        Converter.EVENT_CREATE_PARAMETER,
        saveDefaultValues
    );

    // application.converter.on(Converter.EVENT_RESOLVE, (context, reflection)=>{

    //     if(reflection.comment && reflection.comment.blockTags !== undefined && reflection.comment.blockTags.length > 0){
    //         reflection.comment.blockTags.forEach((blockTag)=>{
    //             if(blockTag.tag == "@translation"){
    //                 console.log(reflection.comment);
    //                 console.log(blockTag.content);
    //             }
    //         });
    //     }
    // })

    function saveDefaultValues(_context, reflection) {
        const node =
            reflection.project.getSymbolFromReflection(reflection)
                ?.declarations?.[0];
        if (!node || !node.initializer) return;

        if (
            node.initializer.kind ===
            TypeScript.SyntaxKind.ObjectLiteralExpression
        ) {
            // Unfortunately can't just set defaultValue right here, this happens before TD sets it.
            defaultValues.set(
                reflection,
                printer.printNode(
                    TypeScript.EmitHint.Expression,
                    node.initializer,
                    node.getSourceFile()
                )
            );
        }
    }

    application.converter.on(Converter.EVENT_RESOLVE_BEGIN, () => {
        for (const [refl, init] of defaultValues) {
            refl.defaultValue = init;
        }
        defaultValues.clear();
    });
};


/**!SECTION
 * @param {Reflection} reflection
 */
function hasCustomTag(reflection){
    let count = 0;
    if(reflection.comment){
        reflection.comment.blockTags.forEach((blockTag)=>{
            if(blockTag.tag == "@group"){
                console.log(blockTag);
                console.log(blockTag.content)
                count++;
            }
        });
    }

    return count > 0;
}

function removeCustomTag(reflection){
    if(reflection.comment){
        reflection.comment.blockTags = reflection.comment.blockTags.filter((blockTag)=>{
            return blockTag.tag != "@customtag";
        });
    }
    return reflection;
}