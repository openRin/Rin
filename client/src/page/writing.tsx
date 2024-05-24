import { MilkdownProvider } from '@milkdown/react';
import { MilkdownEditor } from './editor/editor';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/react';
import { useRef } from 'react';
import { client } from '../main';
import { headersWithAuth } from '../utils/auth';


async function publish(title: string, content: string, tags: string[], draft: boolean) {
  const { data, error } = await client.feed.index.post({
    title,
    content,
    tags,
    draft
  }, {
    headers: headersWithAuth()
  })
  if (error) {
    alert(error.value)
  }
  if (typeof data != 'string') {
    alert('发布成功')
    localStorage.removeItem('markdown')
    localStorage.removeItem('title')
    localStorage.removeItem('tags')
    window.location.href = '/feed/' + data?.insertedId
  }
}



// 写作页面
export function WritingPage() {
  const titleRef = useRef<HTMLInputElement>(null)
  const tagsRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef<HTMLInputElement>(null)
  function publishButton() {
    const title = titleRef.current?.value
    const tags = tagsRef.current?.value.split('#').filter(tag => tag !== '').map(tag => tag.trim()) || []
    const draft = draftRef.current?.checked ?? true
    if (!title) {
      alert('标题不能为空')
      return
    }
    const content = localStorage.getItem('markdown') || ''
    if (!content) {
      alert('内容不能为空')
      return
    }
    publish(title, content, tags, draft)
  }

  return (
    <div className='flex flex-row justify-start mt-8'>
      <div className='basis-1/4' />
      <div className='basis-1/2 prose prose-neutral'>
        <MilkdownProvider>
          <ProsemirrorAdapterProvider>
            <MilkdownEditor />
          </ProsemirrorAdapterProvider>
        </MilkdownProvider>
      </div>
      <div className='basis-1/4 flex flex-col'>
        <div className='bg-white rounded-2xl shadow-xl shadow-neutral-200 p-4 mb-8 mx-8'>
          <input ref={titleRef} type='text' placeholder='标题' defaultValue={localStorage.getItem("title") ?? ""} onChange={() => localStorage.setItem("title", titleRef.current?.value ?? "")} className='w-full py-2 px-4 rounded-xl' />
          <input ref={tagsRef} type='text' placeholder='标签' defaultValue={localStorage.getItem("tags") ?? ""} onChange={() => localStorage.setItem("tags", tagsRef.current?.value ?? "")} className='mt-4 w-full py-2 px-4 rounded-xl' />
          <div className='select-none flex flex-row justify-between items-center mt-4 mb-2 px-4' onClick={() => draftRef.current?.click()}>
            <p>保存为草稿</p>
            <input type='checkbox' ref={draftRef} defaultChecked={true} onChange={() => { draftRef.current?.click() }} />
          </div>
        </div>
        <div className='flex flex-row justify-center'>
          <button onClick={publishButton} className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-neutral-200'>发布</button>
        </div>
      </div>
    </div>
  )
}
