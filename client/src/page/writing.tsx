import { MilkdownProvider } from '@milkdown/react';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/react';
import React, { useEffect, useState } from 'react';
import { Padding } from '../components/padding';
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
  const [title, setTitle] = useState(localStorage.getItem("title") ?? "")
  const [tags, setTags] = useState(localStorage.getItem("tags") ?? "")
  const [alias, setAlias] = useState(localStorage.getItem("alias") ?? "")
  const [draft, setDraft] = useState(false)
  const [id, setId] = useState<number | undefined>(undefined)
  function publishButton() {
    const tagsplit = tags.split('#').filter(tag => tag !== '').map(tag => tag.trim()) || []
    const content = localStorage.getItem('markdown') || undefined
    if (id != undefined) {
      update({ id, title, content, alias, tags: tagsplit, draft })
    } else {
      if (!title) {
        alert('标题不能为空')
        return
      }
      if (!content) {
        alert('内容不能为空')
        return
      }
      publish({ title, content, tags: tagsplit, draft, alias })
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
          if (data.title)
            setTitle(data.title)
          if (data.hashtags)
            setTags(data.hashtags.map(({ name }) => `#${name}`).join(' '))
          if (data.alias)
            setAlias(data.alias)
          setId(data.id)
          setData(data.content)
          setDraft(data.draft === 1)
        }
      })
    }
  }, [])

  return (
    <Padding>
      <div className='flex flex-row justify-start'>
        <div className='xl:basis-1/4 transition-all duration-300' />
        <div className='writeauto xl:basis-1/2 pb-8'>
          <div className='visible md:hidden bg-white rounded-2xl shadow-xl shadow-neutral-200 p-4 mb-8'>
            <Input id="title" value={title} setValue={setTitle} placeholder='标题' />
            <Input id="tags" value={tags} setValue={setTags} placeholder='标签' className='mt-4' />
            <Input id="alias" value={alias} setValue={setAlias} placeholder='别名' className='mt-4' />
            <div className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4' onClick={() => setDraft(!draft)}>
              <p>仅自己可见</p>
              <Checkbox id="draft" value={draft} setValue={setDraft} placeholder='草稿' />
            </div>
          </div>
          <div className='prose prose-neutral'>
            <MilkdownProvider>
              <ProsemirrorAdapterProvider>
                {idOrAlias && data != null && <MilkdownEditor data={data} readonly={false} />}
                {!idOrAlias && <MilkdownEditor readonly={false} />}
              </ProsemirrorAdapterProvider>
            </MilkdownProvider>
          </div>
          <div className='flex flex-row justify-center'>
            <button onClick={publishButton} className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-neutral-200'>发布</button>
          </div>
        </div>
        <div className='hidden md:visible basis-1/2 md:basis-1/4 md:flex flex-col'>
          <div className='fixed'>
            <div className='bg-white rounded-2xl shadow-xl shadow-neutral-200 p-4 my-8 mx-8'>
              <Input id="title" value={title} setValue={setTitle} placeholder='标题' />
              <Input id="tags" value={tags} setValue={setTags} placeholder='标签' className='mt-4' />
              <Input id="alias" value={alias} setValue={setAlias} placeholder='别名' className='mt-4' />
              <div className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4' onClick={() => setDraft(!draft)}>
                <p>仅自己可见</p>
                <Checkbox id="draft" value={draft} setValue={setDraft} placeholder='草稿' />
              </div>
            </div>
            <div className='flex flex-row justify-center'>
              <button onClick={publishButton} className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-neutral-200'>发布</button>
            </div>
          </div>
        </div>
      </div>
    </Padding>
  )
}


function Input({ value, setValue, className, placeholder, id }: { value: string, className?: string, placeholder: string, id: string, setValue: React.Dispatch<React.SetStateAction<string>> }) {
  return (<input type='text'
    placeholder={placeholder}
    value={value}
    onChange={(event) => {
      setValue(event.target.value)
      localStorage.setItem(id, value)
    }}
    className={'w-full py-2 px-4 rounded-xl ' + className} />
  )
}
function Checkbox({ value, setValue, className, placeholder }: { value: boolean, className?: string, placeholder: string, id: string, setValue: React.Dispatch<React.SetStateAction<boolean>> }) {
  return (<input type='checkbox'
    placeholder={placeholder}
    checked={value}
    onChange={(event) => {
      setValue(event.target.checked)
    }}
    className={className} />
  )
}