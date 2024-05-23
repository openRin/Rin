import { BoldItalicUnderlineToggles, headingsPlugin, listsPlugin, markdownShortcutPlugin, MDXEditor, quotePlugin, thematicBreakPlugin, toolbarPlugin, UndoRedo } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css'

// 写作页面
export function WritingPage() {
    return (
        <div className='w-full'>
            <MDXEditor markdown="# Hello world" contentEditableClassName="prose" plugins={
                [
                    headingsPlugin(),
                    listsPlugin(),
                    quotePlugin(),
                    thematicBreakPlugin(),
                    markdownShortcutPlugin(),
                    toolbarPlugin({
                        toolbarContents: () => (
                          <>
                            {' '}
                            <UndoRedo />
                            <BoldItalicUnderlineToggles />
                          </>
                        )
                      })              
                ]} />
        </div>
    )
}