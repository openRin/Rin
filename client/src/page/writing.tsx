import { AdmonitionDirectiveDescriptor, BlockTypeSelect, BoldItalicUnderlineToggles, ChangeCodeMirrorLanguage, codeBlockPlugin, codeMirrorPlugin, CreateLink, diffSourcePlugin, DiffSourceToggleWrapper, directivesPlugin, headingsPlugin, InsertAdmonition, linkDialogPlugin, listsPlugin, markdownShortcutPlugin, MDXEditor, MDXEditorMethods, quotePlugin, thematicBreakPlugin, toolbarPlugin, UndoRedo } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css'
import { useRef } from 'react';

// 写作页面
export function WritingPage() {
  const ref = useRef<MDXEditorMethods>(null)
  return (
    <div className='w-full'>
      <MDXEditor markdown="# Hello world" ref={ref} contentEditableClassName="prose" plugins={
        [
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          codeBlockPlugin(),
          thematicBreakPlugin(),
          codeMirrorPlugin(),
          markdownShortcutPlugin(),
          linkDialogPlugin(),
          diffSourcePlugin(),
          directivesPlugin({ directiveDescriptors: [AdmonitionDirectiveDescriptor] }),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                {' '}
                <DiffSourceToggleWrapper >
                  <UndoRedo />
                  <BoldItalicUnderlineToggles />
                  <BlockTypeSelect />
                  <CreateLink />
                  <InsertAdmonition />
                </DiffSourceToggleWrapper>
              </>
            )
          })
        ]} />
    </div>
  )
}