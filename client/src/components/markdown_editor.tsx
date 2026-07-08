import Editor from '@monaco-editor/react';
import { editor, Range, Selection } from 'monaco-editor';
import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Loading from 'react-loading';
import { FlatInset, FlatTabButton } from "@rin/ui";
import { useAlert } from "./dialog";
import { useColorMode } from "../utils/darkModeUtils";
import { buildMarkdownImage, uploadImageFile } from "../utils/image-upload";
import { Markdown } from "./markdown";


interface MarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
}

type EditorPosition = {
  lineNumber: number;
  column: number;
};

type PlainTextRange = {
  start: number;
  end: number;
};

function positionAfterText(startLineNumber: number, startColumn: number, text: string): EditorPosition {
  const lines = text.split("\n");

  if (lines.length === 1) {
    return {
      lineNumber: startLineNumber,
      column: startColumn + text.length,
    };
  }

  return {
    lineNumber: startLineNumber + lines.length - 1,
    column: lines[lines.length - 1].length + 1,
  };
}

function MarkdownToolButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-lg t-secondary transition-colors hover:border-black/10 hover:bg-neutral-100 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-white/10 dark:hover:bg-neutral-700 dark:hover:text-white sm:h-10 sm:w-10"
    >
      <i className={icon} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function MarkdownEditor({ content, setContent, placeholder = "> Write your content here...", height = "400px" }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plainTextSelectionRef = useRef<PlainTextRange>({ start: 0, end: 0 });
  const isComposingRef = useRef(false);
  const [preview, setPreview] = useState<'edit' | 'preview' | 'comparison'>('edit');
  const [uploading, setUploading] = useState(false);
  const [usePlainTextEditor, setUsePlainTextEditor] = useState(false);
  const { showAlert, AlertUI } = useAlert();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;

    // Monaco is great on desktop, but mobile browsers often cannot long-press
    // select/copy/paste reliably inside Monaco's hidden-textarea input model.
    // Use a native textarea on touch/small-screen devices so the OS clipboard
    // and selection handles work normally.
    const mediaQuery = window.matchMedia("(pointer: coarse), (max-width: 640px)");
    const updateEditorMode = () => setUsePlainTextEditor(mediaQuery.matches);

    updateEditorMode();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateEditorMode);
      return () => mediaQuery.removeEventListener("change", updateEditorMode);
    }

    mediaQuery.addListener(updateEditorMode);
    return () => mediaQuery.removeListener(updateEditorMode);
  }, []);

  useEffect(() => {
    if (usePlainTextEditor) {
      editorRef.current = undefined;
    }
  }, [usePlainTextEditor]);

  async function insertImage(
    file: File,
    range: Selection | PlainTextRange,
    showAlert: (msg: string) => void,
  ) {
    try {
      const result = await uploadImageFile(file);
      const markdownImage = buildMarkdownImage(file.name, result.url, {
        blurhash: result.blurhash,
        width: result.width,
        height: result.height,
      });

      if ("startLineNumber" in range) {
        const editorInstance = editorRef.current;
        if (!editorInstance) return;
        editorInstance.executeEdits(undefined, [{
          range,
          text: markdownImage,
        }]);
        setContent(editorInstance.getValue());
        return;
      }

      replacePlainTextRange(range.start, range.end, markdownImage);
    } catch (error) {
      console.error(error);
      showAlert(error instanceof Error ? error.message : t("upload.failed"));
    }
  }

  const getPlainTextSelection = (): PlainTextRange => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const start = Math.min(plainTextSelectionRef.current.start, content.length);
      const end = Math.min(plainTextSelectionRef.current.end, content.length);
      return { start, end };
    }

    const start = Math.min(textarea.selectionStart, textarea.selectionEnd);
    const end = Math.max(textarea.selectionStart, textarea.selectionEnd);
    plainTextSelectionRef.current = { start, end };
    return { start, end };
  };

  const rememberPlainTextSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = Math.min(textarea.selectionStart, textarea.selectionEnd);
    const end = Math.max(textarea.selectionStart, textarea.selectionEnd);
    plainTextSelectionRef.current = { start, end };
  };

  const focusPlainTextSelection = (range: PlainTextRange) => {
    plainTextSelectionRef.current = range;

    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(range.start, range.end);
    });
  };

  const replacePlainTextRange = (start: number, end: number, text: string, nextSelection?: PlainTextRange) => {
    const nextContent = `${content.slice(0, start)}${text}${content.slice(end)}`;
    const cursor = start + text.length;
    setContent(nextContent);
    focusPlainTextSelection(nextSelection ?? { start: cursor, end: cursor });
  };

  const getPlainTextLineBounds = (selection: PlainTextRange) => {
    const startLineStart = content.lastIndexOf("\n", Math.max(0, selection.start - 1)) + 1;
    const effectiveEnd = selection.end > selection.start && content[selection.end - 1] === "\n"
      ? selection.end - 1
      : selection.end;
    const nextLineBreak = content.indexOf("\n", effectiveEnd);
    const endLineEnd = nextLineBreak === -1 ? content.length : nextLineBreak;

    return { startLineStart, endLineEnd };
  };

  const getEditorAndSelection = () => {
    const editorInstance = editorRef.current;
    const model = editorInstance?.getModel();
    const selection = editorInstance?.getSelection();

    if (!editorInstance || !model || !selection) {
      return null;
    }

    return { editorInstance, model, selection };
  };

  const replaceSelection = (selection: Selection, text: string, nextSelection?: Selection) => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;

    editorInstance.executeEdits("markdown-toolbar", [{
      range: selection,
      text,
      forceMoveMarkers: true,
    }]);
    setContent(editorInstance.getValue());

    if (nextSelection) {
      editorInstance.setSelection(nextSelection);
    } else {
      const position = positionAfterText(selection.startLineNumber, selection.startColumn, text);
      editorInstance.setPosition(position);
    }

    editorInstance.focus();
  };

  const wrapSelection = (prefix: string, suffix: string, fallback: string) => {
    if (usePlainTextEditor) {
      const selection = getPlainTextSelection();
      const selectedText = content.slice(selection.start, selection.end);
      const innerText = selectedText || fallback;
      const insertedText = `${prefix}${innerText}${suffix}`;
      const innerStart = selection.start + prefix.length;
      const innerEnd = innerStart + innerText.length;
      const end = selection.start + insertedText.length;

      replacePlainTextRange(
        selection.start,
        selection.end,
        insertedText,
        selectedText ? { start: end, end } : { start: innerStart, end: innerEnd },
      );
      return;
    }

    const editorState = getEditorAndSelection();
    if (!editorState) return;

    const { model, selection } = editorState;
    const selectedText = model.getValueInRange(selection);
    const innerText = selectedText || fallback;
    const insertedText = `${prefix}${innerText}${suffix}`;
    const innerStart = positionAfterText(selection.startLineNumber, selection.startColumn, prefix);
    const innerEnd = positionAfterText(innerStart.lineNumber, innerStart.column, innerText);
    const end = positionAfterText(selection.startLineNumber, selection.startColumn, insertedText);
    const nextSelection = selectedText
      ? new Selection(end.lineNumber, end.column, end.lineNumber, end.column)
      : new Selection(innerStart.lineNumber, innerStart.column, innerEnd.lineNumber, innerEnd.column);

    replaceSelection(selection, insertedText, nextSelection);
  };

  const insertLink = () => {
    if (usePlainTextEditor) {
      const selection = getPlainTextSelection();
      const selectedText = content.slice(selection.start, selection.end);
      const label = selectedText || t("markdown_editor.placeholder.link_text");
      const url = t("markdown_editor.placeholder.link_url");
      const prefix = `[${label}](`;
      const insertedText = `${prefix}${url})`;
      const urlStart = selection.start + prefix.length;
      const urlEnd = urlStart + url.length;

      replacePlainTextRange(selection.start, selection.end, insertedText, { start: urlStart, end: urlEnd });
      return;
    }

    const editorState = getEditorAndSelection();
    if (!editorState) return;

    const { model, selection } = editorState;
    const selectedText = model.getValueInRange(selection);
    const label = selectedText || t("markdown_editor.placeholder.link_text");
    const url = t("markdown_editor.placeholder.link_url");
    const prefix = `[${label}](`;
    const insertedText = `${prefix}${url})`;
    const urlStart = positionAfterText(selection.startLineNumber, selection.startColumn, prefix);
    const urlEnd = positionAfterText(urlStart.lineNumber, urlStart.column, url);

    replaceSelection(selection, insertedText, new Selection(urlStart.lineNumber, urlStart.column, urlEnd.lineNumber, urlEnd.column));
  };

  const insertMarkdownImage = () => {
    if (usePlainTextEditor) {
      const selection = getPlainTextSelection();
      const selectedText = content.slice(selection.start, selection.end);
      const alt = selectedText || t("markdown_editor.placeholder.image_alt");
      const url = t("markdown_editor.placeholder.image_url");
      const prefix = `![${alt}](`;
      const insertedText = `${prefix}${url})`;
      const urlStart = selection.start + prefix.length;
      const urlEnd = urlStart + url.length;

      replacePlainTextRange(selection.start, selection.end, insertedText, { start: urlStart, end: urlEnd });
      return;
    }

    const editorState = getEditorAndSelection();
    if (!editorState) return;

    const { model, selection } = editorState;
    const selectedText = model.getValueInRange(selection);
    const alt = selectedText || t("markdown_editor.placeholder.image_alt");
    const url = t("markdown_editor.placeholder.image_url");
    const prefix = `![${alt}](`;
    const insertedText = `${prefix}${url})`;
    const urlStart = positionAfterText(selection.startLineNumber, selection.startColumn, prefix);
    const urlEnd = positionAfterText(urlStart.lineNumber, urlStart.column, url);

    replaceSelection(selection, insertedText, new Selection(urlStart.lineNumber, urlStart.column, urlEnd.lineNumber, urlEnd.column));
  };

  const insertCodeBlock = () => {
    if (usePlainTextEditor) {
      const selection = getPlainTextSelection();
      const selectedText = content.slice(selection.start, selection.end);
      const innerText = selectedText || t("markdown_editor.placeholder.code_block");
      const prefix = "```\n";
      const insertedText = `${prefix}${innerText}\n\`\`\``;
      const innerStart = selection.start + prefix.length;
      const innerEnd = innerStart + innerText.length;
      const end = selection.start + insertedText.length;

      replacePlainTextRange(
        selection.start,
        selection.end,
        insertedText,
        selectedText ? { start: end, end } : { start: innerStart, end: innerEnd },
      );
      return;
    }

    const editorState = getEditorAndSelection();
    if (!editorState) return;

    const { model, selection } = editorState;
    const selectedText = model.getValueInRange(selection);
    const innerText = selectedText || t("markdown_editor.placeholder.code_block");
    const prefix = "```\n";
    const insertedText = `${prefix}${innerText}\n\`\`\``;
    const innerStart = positionAfterText(selection.startLineNumber, selection.startColumn, prefix);
    const innerEnd = positionAfterText(innerStart.lineNumber, innerStart.column, innerText);
    const end = positionAfterText(selection.startLineNumber, selection.startColumn, insertedText);
    const nextSelection = selectedText
      ? new Selection(end.lineNumber, end.column, end.lineNumber, end.column)
      : new Selection(innerStart.lineNumber, innerStart.column, innerEnd.lineNumber, innerEnd.column);

    replaceSelection(selection, insertedText, nextSelection);
  };

  const insertHorizontalRule = () => {
    if (usePlainTextEditor) {
      const selection = getPlainTextSelection();
      replacePlainTextRange(selection.start, selection.end, "\n---\n");
      return;
    }

    const editorState = getEditorAndSelection();
    if (!editorState) return;

    replaceSelection(editorState.selection, "\n---\n");
  };

  const formatSelectedLines = (
    formatter: (line: string, index: number) => string,
    emptyLineFallback: string,
  ) => {
    if (usePlainTextEditor) {
      const selection = getPlainTextSelection();
      const { startLineStart, endLineEnd } = getPlainTextLineBounds(selection);
      const selectedBlock = content.slice(startLineStart, endLineEnd);
      const isEmptySingleLine = selection.start === selection.end && selectedBlock.trim().length === 0;
      const insertedText = isEmptySingleLine
        ? emptyLineFallback
        : selectedBlock.split("\n").map(formatter).join("\n");
      const cursor = startLineStart + insertedText.length;

      replacePlainTextRange(startLineStart, endLineEnd, insertedText, { start: cursor, end: cursor });
      return;
    }

    const editorState = getEditorAndSelection();
    if (!editorState) return;

    const { editorInstance, model, selection } = editorState;
    const startLineNumber = selection.startLineNumber;
    const endLineNumber = selection.endLineNumber > selection.startLineNumber && selection.endColumn === 1
      ? selection.endLineNumber - 1
      : selection.endLineNumber;
    const currentLine = model.getLineContent(startLineNumber);
    const isEmptySingleLine = selection.isEmpty() && currentLine.trim().length === 0;
    const lines = isEmptySingleLine
      ? [emptyLineFallback]
      : Array.from({ length: endLineNumber - startLineNumber + 1 }, (_, index) => {
        const lineNumber = startLineNumber + index;
        return formatter(model.getLineContent(lineNumber), index);
      });
    const targetEndLine = isEmptySingleLine ? startLineNumber : endLineNumber;
    const range = new Range(
      startLineNumber,
      1,
      targetEndLine,
      model.getLineMaxColumn(targetEndLine),
    );
    const insertedText = lines.join("\n");
    const end = positionAfterText(startLineNumber, 1, insertedText);

    editorInstance.executeEdits("markdown-toolbar", [{
      range,
      text: insertedText,
      forceMoveMarkers: true,
    }]);
    setContent(editorInstance.getValue());
    editorInstance.setPosition(end);
    editorInstance.focus();
  };

  const formatHeading = () => {
    formatSelectedLines(
      (line) => line.startsWith("#") ? `## ${line.replace(/^#+\s*/, "")}` : `## ${line}`,
      `## ${t("markdown_editor.placeholder.heading")}`,
    );
  };

  const formatQuote = () => {
    formatSelectedLines(
      (line) => line.startsWith("> ") ? line : `> ${line}`,
      `> ${t("markdown_editor.placeholder.quote")}`,
    );
  };

  const formatUnorderedList = () => {
    formatSelectedLines(
      (line) => line.match(/^\s*[-*]\s/) ? line : `- ${line}`,
      `- ${t("markdown_editor.placeholder.list_item")}`,
    );
  };

  const formatOrderedList = () => {
    formatSelectedLines(
      (line, index) => line.match(/^\s*\d+\.\s/) ? line : `${index + 1}. ${line}`,
      `1. ${t("markdown_editor.placeholder.list_item")}`,
    );
  };

  const markdownActions = [
    { key: "heading", icon: "ri-heading", label: t("markdown_editor.toolbar.heading"), onClick: formatHeading },
    { key: "bold", icon: "ri-bold", label: t("markdown_editor.toolbar.bold"), onClick: () => wrapSelection("**", "**", t("markdown_editor.placeholder.bold")) },
    { key: "italic", icon: "ri-italic", label: t("markdown_editor.toolbar.italic"), onClick: () => wrapSelection("*", "*", t("markdown_editor.placeholder.italic")) },
    { key: "link", icon: "ri-link", label: t("markdown_editor.toolbar.link"), onClick: insertLink },
    { key: "image", icon: "ri-image-line", label: t("markdown_editor.toolbar.image"), onClick: insertMarkdownImage },
    { key: "quote", icon: "ri-double-quotes-l", label: t("markdown_editor.toolbar.quote"), onClick: formatQuote },
    { key: "unordered-list", icon: "ri-list-unordered", label: t("markdown_editor.toolbar.unordered_list"), onClick: formatUnorderedList },
    { key: "ordered-list", icon: "ri-list-ordered", label: t("markdown_editor.toolbar.ordered_list"), onClick: formatOrderedList },
    { key: "inline-code", icon: "ri-code-s-slash-line", label: t("markdown_editor.toolbar.inline_code"), onClick: () => wrapSelection("`", "`", t("markdown_editor.placeholder.code")) },
    { key: "code-block", icon: "ri-code-box-line", label: t("markdown_editor.toolbar.code_block"), onClick: insertCodeBlock },
    { key: "horizontal-rule", icon: "ri-separator", label: t("markdown_editor.toolbar.horizontal_rule"), onClick: insertHorizontalRule },
  ];

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>) => {
    const imageFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!imageFile) return;

    event.preventDefault();
    event.stopPropagation();
    const selection = usePlainTextEditor ? getPlainTextSelection() : editorRef.current?.getSelection();
    if (!selection) return;

    setUploading(true);
    void insertImage(imageFile, selection, showAlert).finally(() => {
      setUploading(false);
    });
  };

  function UploadImageButton() {
    const uploadRef = useRef<HTMLInputElement>(null);
    const label = t("markdown_editor.toolbar.upload_image");
    
    const upChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.currentTarget.files;
      if (!files) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024000) {
          showAlert(t("upload.failed$size", { size: 5 }));
          uploadRef.current!.value = "";
        } else {
          const selection = usePlainTextEditor ? getPlainTextSelection() : editorRef.current?.getSelection();
          if (!selection) return;
          setUploading(true);
          void insertImage(file, selection, showAlert).finally(() => {
            setUploading(false);
          });
        }
      }
    };
    
    return (
      <>
        <input
          ref={uploadRef}
          onChange={upChange}
          className="hidden"
          type="file"
          accept="image/gif,image/jpeg,image/jpg,image/png"
        />
        <MarkdownToolButton
          label={label}
          icon="ri-image-add-line"
          disabled={uploading}
          onClick={() => uploadRef.current?.click()}
        />
      </>
    );
  }

  /* ---------------- Monaco Mount & IME Optimization ---------------- */

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    editor.onDidCompositionStart(() => {
      isComposingRef.current = true;
    });

    editor.onDidCompositionEnd(() => {
      isComposingRef.current = false;
      setContent(editor.getValue());
    });

    editor.onDidChangeModelContent(() => {
      if (!isComposingRef.current) {
        setContent(editor.getValue());
      }
    });

    editor.onDidBlurEditorText(() => {
      setContent(editor.getValue());
    });
  };

  /* ---------------- synchronization ---------------- */

  useEffect(() => {
    if (usePlainTextEditor) return;

    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const editorValue = model.getValue();

    // Avoid infinite loops & prevent overwriting content being edited
    if (editorValue !== content) {
      editor.setValue(content);
    }
  }, [content, usePlainTextEditor]);

  /* ---------------- UI ---------------- */

  return (
    <div className="flex flex-col gap-0 sm:gap-3">
      <FlatInset className="flex flex-wrap items-center gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-2 dark:border-white/10 sm:p-3">
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <FlatTabButton active={preview === 'edit'} onClick={() => setPreview('edit')}> {t("edit")} </FlatTabButton>
          <FlatTabButton active={preview === 'preview'} onClick={() => setPreview('preview')}> {t("preview")} </FlatTabButton>
          <FlatTabButton active={preview === 'comparison'} onClick={() => setPreview('comparison')}> {t("comparison")} </FlatTabButton>
        </div>
        <div className="flex-grow" />
        <div
          className="flex min-w-0 flex-wrap items-center gap-1"
          role="toolbar"
          aria-label={t("markdown_editor.toolbar.label")}
        >
          {markdownActions.map((action) => (
            <MarkdownToolButton
              key={action.key}
              label={action.label}
              icon={action.icon}
              onClick={action.onClick}
            />
          ))}
          <span className="mx-1 hidden h-6 w-px bg-black/10 dark:bg-white/10 sm:block" aria-hidden="true" />
          <UploadImageButton />
        </div>
        {uploading &&
          <div className="flex flex-row items-center space-x-2 px-2">
            <Loading type="spin" color="#FC466B" height={16} width={16} />
            <span className="text-sm text-neutral-500">{t('uploading')}</span>
          </div>
        }
      </FlatInset>
      <div className={`grid grid-cols-1 gap-0 sm:gap-4 ${preview === 'comparison' ? "lg:grid-cols-2" : ""}`}>
        <div className={"flex min-w-0 flex-col " + (preview === 'preview' ? "hidden" : "")}>
          <div
            className={"relative min-h-0 overflow-hidden rounded-none border-0 bg-w"}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const selection = usePlainTextEditor ? getPlainTextSelection() : editorRef.current?.getSelection();
                if (!selection) return;
                const file = e.dataTransfer.files[i];
                setUploading(true);
                void insertImage(file, selection, showAlert).finally(() => {
                  setUploading(false);
                });
              }
            }}
            onPaste={handlePaste}
          >
            {usePlainTextEditor ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => {
                  const textarea = event.currentTarget;
                  setContent(textarea.value);
                  plainTextSelectionRef.current = {
                    start: Math.min(textarea.selectionStart, textarea.selectionEnd),
                    end: Math.max(textarea.selectionStart, textarea.selectionEnd),
                  };
                }}
                onSelect={rememberPlainTextSelection}
                onClick={rememberPlainTextSelection}
                onKeyUp={rememberPlainTextSelection}
                onTouchEnd={rememberPlainTextSelection}
                onPaste={handlePaste}
                placeholder={placeholder}
                spellCheck={false}
                className="block w-full resize-y border-0 bg-w px-4 py-3 font-mono text-sm leading-6 t-primary outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                style={{
                  height,
                  touchAction: "manipulation",
                  userSelect: "text",
                  WebkitUserSelect: "text",
                }}
              />
            ) : (
              <Editor
                onMount={handleEditorMount}
                height={height}
                defaultLanguage="markdown"
                defaultValue={content}
                theme={colorMode === "dark" ? "vs-dark" : "light"}
                options={{
                  wordWrap: "on",

                  // Chinese IME stability key
                  fontFamily: "Sarasa Mono SC, JetBrains Mono, monospace",
                  fontLigatures: false,
                  letterSpacing: 0,

                  fontSize: 14,
                  lineNumbers: "off",

                  accessibilitySupport: "off",
                  unicodeHighlight: { ambiguousCharacters: false },

                  renderWhitespace: "none",
                  renderControlCharacters: false,
                  smoothScrolling: false,

                  dragAndDrop: true,
                  pasteAs: { enabled: false },
                }}
              />
            )}
          </div>
        </div>
        <div
          className={"min-h-0 overflow-y-auto rounded-none border-0 bg-w px-4 py-4 border-t sm:border-none " + (preview === 'edit' ? "hidden" : "")}
          style={{ height: height }}
        >
          <Markdown content={content ? content : placeholder} />
        </div>
      </div>
      <AlertUI />
    </div>
  );
}
