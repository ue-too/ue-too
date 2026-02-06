import { $createCodeNode } from '@lexical/code';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
    $insertList,
    $removeList,
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    ListItemNode,
    ListNode,
    REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalSubscription } from '@lexical/react/useLexicalSubscription';
import {
    $getSelection,
    $insertNodes,
    $isRangeSelection,
    COMMAND_PRIORITY_LOW,
    FORMAT_TEXT_COMMAND,
    REDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    UNDO_COMMAND,
} from 'lexical';
import type { LexicalEditor } from 'lexical';
import {
    Bold,
    Code,
    Italic,
    Link,
    List,
    ListOrdered,
    Redo,
    Underline,
    Undo,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const theme = {
    paragraph: 'mb-2',
    text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        code: 'rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-sm',
    },
    list: {
        ul: 'list-disc pl-6 mb-2',
        ol: 'list-decimal pl-6 mb-2',
        listitem: 'mb-1',
    },
    link: 'text-primary underline underline-offset-2',
    code: 'block rounded bg-neutral-100 p-3 font-mono text-sm overflow-x-auto my-2',
};

type FormatState = {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    code: boolean;
};

const DEFAULT_FORMAT: FormatState = {
    bold: false,
    italic: false,
    underline: false,
    code: false,
};

function formatStateEqual(a: FormatState, b: FormatState): boolean {
    return (
        a.bold === b.bold &&
        a.italic === b.italic &&
        a.underline === b.underline &&
        a.code === b.code
    );
}

function getFormatState(editor: LexicalEditor): FormatState {
    let state: FormatState = { ...DEFAULT_FORMAT };
    editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            state = {
                bold: selection.hasFormat('bold'),
                italic: selection.hasFormat('italic'),
                underline: selection.hasFormat('underline'),
                code: selection.hasFormat('code'),
            };
        }
    });
    return state;
}

function createFormatSubscription(editorRef: LexicalEditor) {
    let lastFormat: FormatState = DEFAULT_FORMAT;
    const notifyIfChanged = (callback: (value: FormatState) => void) => {
        const next = getFormatState(editorRef);
        if (!formatStateEqual(lastFormat, next)) {
            lastFormat = next;
            callback(next);
        }
    };
    return {
        initialValueFn: () => getFormatState(editorRef),
        subscribe: (callback: (value: FormatState) => void) => {
            const unregisterUpdate = editorRef.registerUpdateListener(() => {
                notifyIfChanged(callback);
            });
            const unregisterSelection = editorRef.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    notifyIfChanged(callback);
                    return false;
                },
                COMMAND_PRIORITY_LOW
            );
            return () => {
                unregisterUpdate();
                unregisterSelection();
            };
        },
    };
}

function useFormatState(): FormatState {
    return useLexicalSubscription(createFormatSubscription);
}

function LexicalToolbar(): React.ReactElement {
    const [editor] = useLexicalComposerContext();
    const format = useFormatState();

    useEffect(() => {
        return editor.registerCommand(
            INSERT_UNORDERED_LIST_COMMAND,
            () => {
                editor.update(() => {
                    $insertList('bullet');
                });
                return true;
            },
            COMMAND_PRIORITY_LOW
        );
    }, [editor]);

    useEffect(() => {
        return editor.registerCommand(
            INSERT_ORDERED_LIST_COMMAND,
            () => {
                editor.update(() => {
                    $insertList('number');
                });
                return true;
            },
            COMMAND_PRIORITY_LOW
        );
    }, [editor]);

    useEffect(() => {
        return editor.registerCommand(
            REMOVE_LIST_COMMAND,
            () => {
                editor.update(() => {
                    $removeList();
                });
                return true;
            },
            COMMAND_PRIORITY_LOW
        );
    }, [editor]);

    const insertCodeBlock = useCallback(() => {
        editor.update(() => {
            const codeNode = $createCodeNode();
            $insertNodes([codeNode]);
            codeNode.selectEnd();
        });
    }, [editor]);

  const toggleLink = useCallback(() => {
    const url = window.prompt('Enter URL:', 'https://');
    if (url == null) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url === '' ? null : url);
  }, [editor]);

    return (
        <Card className="pointer-events-auto flex flex-row flex-wrap items-center gap-1 px-2 py-1.5">
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Undo"
                onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
            >
                <Undo />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Redo"
                onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
            >
                <Redo />
            </Button>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Button
                variant={format.bold ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-label="Bold"
                aria-pressed={format.bold}
                onClick={() =>
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
                }
            >
                <Bold />
            </Button>
            <Button
                variant={format.italic ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-label="Italic"
                aria-pressed={format.italic}
                onClick={() =>
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
                }
            >
                <Italic />
            </Button>
            <Button
                variant={format.underline ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-label="Underline"
                aria-pressed={format.underline}
                onClick={() =>
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')
                }
            >
                <Underline />
            </Button>
            <Button
                variant={format.code ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-label="Inline code"
                aria-pressed={format.code}
                onClick={() =>
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
                }
            >
                <Code />
            </Button>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Bullet list"
                onClick={() =>
                    editor.dispatchCommand(
                        INSERT_UNORDERED_LIST_COMMAND,
                        undefined
                    )
                }
            >
                <List />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Numbered list"
                onClick={() =>
                    editor.dispatchCommand(
                        INSERT_ORDERED_LIST_COMMAND,
                        undefined
                    )
                }
            >
                <ListOrdered />
            </Button>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Link"
                onClick={toggleLink}
            >
                <Link />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Code block"
                onClick={insertCodeBlock}
            >
                <Code className="size-4" />
                <span className="ml-1 text-xs">Block</span>
            </Button>
        </Card>
    );
}

const initialNodes = [
    ListNode,
    ListItemNode,
    LinkNode,
    CodeNode,
    CodeHighlightNode,
];

/**
 * Demo rich text editor with playground-style features (lists, links, code)
 * and a shadcn-based toolbar.
 */
export function DemoLexicalEditor(): React.ReactElement {
    const initialConfig = {
        namespace: 'DemoLexicalEditor',
        theme,
        nodes: initialNodes,
        onError: (error: Error) => {
            console.error('Lexical error:', error);
        },
    };

    return (
        <LexicalComposer initialConfig={initialConfig}>
            <div className="flex flex-col gap-2">
                <LexicalToolbar />
                <div className="relative rounded border border-neutral-200 bg-white p-3 focus-within:ring-2 focus-within:ring-neutral-400">
                    <RichTextPlugin
                        contentEditable={
                            <ContentEditable className="min-h-[200px] outline-none" />
                        }
                        placeholder={
                            <div className="pointer-events-none absolute top-3 left-3 text-neutral-400">
                                Enter some text...
                            </div>
                        }
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                    <ListPlugin />
                    <LinkPlugin />
                    <HistoryPlugin />
                    <AutoFocusPlugin />
                </div>
            </div>
        </LexicalComposer>
    );
}
