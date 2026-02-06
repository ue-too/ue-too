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
    $getRoot,
    $getSelection,
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
    GripVertical,
    Italic,
    Link,
    List,
    ListOrdered,
    Redo,
    Underline,
    Undo,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

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

  const toggleLink = useCallback(() => {
    const url = window.prompt('Enter URL:', 'https://');
    if (url == null) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url === '' ? null : url);
  }, [editor]);

    return (
        <Card className="pointer-events-auto flex flex-row flex-wrap items-center gap-1 px-2 py-1.5 min-h-[40px] w-fit shadow-md border">
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

const MIN_EDITOR_WIDTH = 240;
const MIN_EDITOR_HEIGHT = 160;
const DEFAULT_EDITOR_WIDTH = 480;
const DEFAULT_EDITOR_HEIGHT = 280;

const EditorEmptyRefContext = createContext<React.MutableRefObject<boolean> | null>(null);

function isEditorEmpty(editor: LexicalEditor): boolean {
    let empty = true;
    editor.getEditorState().read(() => {
        const root = $getRoot();
        const first = root.getFirstChild();
        empty = root.getChildrenSize() === 1 && first != null && 'isEmpty' in first && typeof first.isEmpty === 'function' && first.isEmpty();
    });
    return empty;
}

/** Syncs editor empty state into a ref so the parent can read it without re-renders. */
function EditorEmptyRefSync(): null {
    const [editor] = useLexicalComposerContext();
    const emptyRef = useContext(EditorEmptyRefContext);

    useEffect(() => {
        if (emptyRef == null) return;
        const update = () => {
            emptyRef.current = isEditorEmpty(editor);
        };
        update();
        const unregister = editor.registerUpdateListener(update);
        return unregister;
    }, [editor, emptyRef]);

    return null;
}

/**
 * Demo rich text editor with playground-style features (lists, links, code)
 * and a shadcn-based toolbar. The editor box is draggable and resizable.
 */
export function DemoLexicalEditor(): React.ReactElement {
    const editorEmptyRef = useRef(true);
    const [box, setBox] = useState({
        x: 0,
        y: 0,
        width: DEFAULT_EDITOR_WIDTH,
        height: DEFAULT_EDITOR_HEIGHT,
    });
    const [isSelected, setIsSelected] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; startY: number; startBoxX: number; startBoxY: number } | null>(null);
    const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

    /** When empty: first click goes straight to edit. When not empty: first click selects, second click edits. */
    const handleContentAreaMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return;
            const editable = contentAreaRef.current?.querySelector<HTMLElement>('[contenteditable="true"]');
            if (!isSelected) {
                if (editorEmptyRef.current) {
                    setIsSelected(true);
                    editable?.focus();
                } else {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsSelected(true);
                }
            } else {
                if (editable != null && !editable.contains(e.target as Node)) {
                    editable.focus();
                }
            }
        },
        [isSelected]
    );

    useEffect(() => {
        const onDocumentMouseDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (boxRef.current != null && !boxRef.current.contains(target)) {
                setIsSelected(false);
            }
        };
        document.addEventListener('mousedown', onDocumentMouseDown);
        return () => document.removeEventListener('mousedown', onDocumentMouseDown);
    }, []);

    const handleDragStart = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return;
            e.preventDefault();
            if (!isSelected) {
                e.stopPropagation();
                setIsSelected(true);
                return;
            }
            dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startBoxX: box.x,
                startBoxY: box.y,
            };
        },
        [box.x, box.y, isSelected]
    );

    const handleResizeStart = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            if (!isSelected) {
                setIsSelected(true);
                return;
            }
            resizeRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startW: box.width,
                startH: box.height,
            };
        },
        [box.width, box.height, isSelected]
    );

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (resizeRef.current != null) {
                const dx = e.clientX - resizeRef.current.startX;
                const dy = e.clientY - resizeRef.current.startY;
                setBox((prev) => ({
                    ...prev,
                    width: Math.max(MIN_EDITOR_WIDTH, resizeRef.current!.startW + dx),
                    height: Math.max(MIN_EDITOR_HEIGHT, resizeRef.current!.startH + dy),
                }));
            } else if (dragRef.current != null) {
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                setBox((prev) => ({
                    ...prev,
                    x: dragRef.current!.startBoxX + dx,
                    y: dragRef.current!.startBoxY + dy,
                }));
            }
        };

        const onUp = () => {
            dragRef.current = null;
            resizeRef.current = null;
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, []);

    const initialConfig = {
        namespace: 'DemoLexicalEditor',
        theme,
        nodes: initialNodes,
        onError: (error: Error) => {
            console.error('Lexical error:', error);
        },
    };

    return (
        <div className="relative min-h-[80vh] w-full">
            <EditorEmptyRefContext.Provider value={editorEmptyRef}>
                <LexicalComposer initialConfig={initialConfig}>
                    <EditorEmptyRefSync />
                    <div
                        ref={boxRef}
                        className={`group absolute rounded-lg outline-none transition-shadow ${isSelected ? 'ring-2 ring-neutral-400 ring-offset-2' : ''}`}
                        style={{
                            left: box.x,
                            top: box.y,
                            width: box.width,
                            height: box.height,
                        }}
                    >
                    {/* Drag handle: top bar */}
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Drag to move editor"
                        className="flex cursor-grab items-center justify-center border-b border-neutral-200 bg-neutral-50 py-1.5 text-neutral-500 active:cursor-grabbing"
                        onMouseDown={handleDragStart}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                        }}
                    >
                        <GripVertical className="size-4" />
                    </div>
                    {/* Floating toolbar */}
                    <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-h-[40px] w-fit opacity-0 pointer-events-none transition-opacity duration-200 group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                    >
                        <LexicalToolbar />
                    </div>
                    {/* Editor content area: first click selects box, second click enters edit mode */}
                    <div
                        ref={contentAreaRef}
                        className="relative flex h-[calc(100%-2.25rem)] flex-col overflow-hidden rounded-b border-x border-b border-neutral-200 bg-white focus-within:ring-2 focus-within:ring-neutral-400 focus-within:ring-inset cursor-text"
                        onMouseDown={handleContentAreaMouseDown}
                    >
                        <RichTextPlugin
                            contentEditable={
                                <ContentEditable className="min-h-0 flex-1 outline-none p-3" />
                            }
                            placeholder={
                                <div className="pointer-events-none absolute top-3 left-3 text-neutral-400">
                                    {isSelected ? 'Click again to type...' : 'Click to select'}
                                </div>
                            }
                            ErrorBoundary={LexicalErrorBoundary}
                        />
                        <ListPlugin />
                        <LinkPlugin />
                        <HistoryPlugin />
                    </div>
                    {/* Resize handle: bottom-right corner */}
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Drag to resize editor"
                        className="absolute bottom-0 right-0 z-10 cursor-se-resize p-2"
                        style={{ margin: '-4px -4px 0 0' }}
                        onMouseDown={handleResizeStart}
                    >
                        <svg
                            className="size-4 text-neutral-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <path d="M15 9v6h-6M21 15v4a2 2 0 0 1-2 2h-4M15 21h6" />
                        </svg>
                    </div>
                </div>
                </LexicalComposer>
            </EditorEmptyRefContext.Provider>
        </div>
    );
}
