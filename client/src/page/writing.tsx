import { MilkdownProvider } from '@milkdown/react';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/react';
import { useEffect, useRef, useState } from 'react';
import { client } from '../main';
import { headersWithAuth } from '../utils/auth';
import { MilkdownEditor } from './editor/editor';


async function publish({ title, alias, content, tags, draft }: { title: string, content: string, tags: string[], draft: boolean, alias?: string }) {
  const { data, error } = await client.feed.index.post({
    title,
    alias,
    content,
    tags,
    draft
  }, {
    headers: headersWithAuth()
  })
  if (error) {
    alert(error.value)
  }
  if (data && typeof data != 'string') {
    alert('发布成功')
    localStorage.removeItem('markdown')
    localStorage.removeItem('title')
    localStorage.removeItem('tags')
    window.location.href = '/feed/' + data.insertedId
  }
}

async function update({ id, title, alias, content, tags, draft }: { id: number, title?: string, alias?: string, content?: string, tags?: string[], draft?: boolean }) {
  const { error } = await client.feed({ id }).post({
    title,
    alias,
    content,
    tags,
    draft
  }, {
    headers: headersWithAuth()
  })
  if (error) {
    alert(error.value)
  } else {
    alert('更新成功')
    localStorage.removeItem('markdown')
    localStorage.removeItem('title')
    localStorage.removeItem('tags')
    window.location.href = '/feed/' + id
  }
}



// 写作页面
export function WritingPage({ idOrAlias }: { idOrAlias?: string }) {
  const titleRef = useRef<HTMLInputElement>(null)
  const tagsRef = useRef<HTMLInputElement>(null)
  const aliasRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef<HTMLInputElement>(null)
  const [id, setId] = useState<number | undefined>(undefined)
  function publishButton() {
    const title = titleRef.current?.value
    const tags = tagsRef.current?.value.split('#').filter(tag => tag !== '').map(tag => tag.trim()) || []
    const draft = draftRef.current?.checked ?? true
    const content = localStorage.getItem('markdown') || undefined
    const alias = aliasRef.current?.value || undefined
    if (id != undefined) {
      update({ id, title, content, alias, tags, draft })
    } else {
      if (!title) {
        alert('标题不能为空')
        return
      }
      if (!content) {
        alert('内容不能为空')
        return
      }
      publish({ title, content, tags, draft, alias })
    }
  }
  const [data, setData] = useState<string | null>(null)
  useEffect(() => {
    console.log(idOrAlias)
    if (idOrAlias) {
      client.feed({ id: idOrAlias }).get({
        headers: headersWithAuth()
      }).then(({ data }) => {
        if (data && typeof data !== 'string') {
          if (data.title && titleRef.current)
            titleRef.current.value = data.title
          if (data.hashtags)
            tagsRef.current!.value = data.hashtags.map(({ name }) => `#${name}`).join(' ')
          if (data.alias && aliasRef.current)
            aliasRef.current.value = data.alias
          setId(data.id)
          setData(data.content)
          draftRef.current!.checked = (data.draft === 1)
        }
      })
    }
  }, [])

  return (
    <div className='flex flex-row justify-start mt-8 mx-32'>
      <div className='basis-1/4' />
      <div className='basis-1/2 prose prose-neutral'>
        <MilkdownProvider>
          <ProsemirrorAdapterProvider>
            {idOrAlias && data != null && <MilkdownEditor data={data} readonly={false} />}
            {!idOrAlias && <MilkdownEditor readonly={false} />}
          </ProsemirrorAdapterProvider>
        </MilkdownProvider>
      </div>
      <div className='basis-1/4 flex flex-col'>
        <div className='bg-white rounded-2xl shadow-xl shadow-neutral-200 p-4 mb-8 ml-8'>
          <input ref={titleRef} type='text' placeholder='标题' defaultValue={localStorage.getItem("title") ?? ""} onChange={() => localStorage.setItem("title", titleRef.current?.value ?? "")} className='w-full py-2 px-4 rounded-xl' />
          <input ref={tagsRef} type='text' placeholder='标签' defaultValue={localStorage.getItem("tags") ?? ""} onChange={() => localStorage.setItem("tags", tagsRef.current?.value ?? "")} className='mt-4 w-full py-2 px-4 rounded-xl' />
          <input ref={aliasRef} type='text' placeholder='别名' defaultValue={localStorage.getItem("alias") ?? ""} onChange={() => localStorage.setItem("alias", aliasRef.current?.value ?? "")} className='mt-4 w-full py-2 px-4 rounded-xl' />
          <div className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4' onClick={() => draftRef.current?.click()}>
            <p>仅自己可见</p>
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
