import MDEditor from '@uiw/react-md-editor';
import { useEffect, useState } from 'react';
import { Checkbox, Input } from '../components/input';
import { Padding } from '../components/padding';
import { client } from '../main';
import { headersWithAuth } from '../utils/auth';
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

async function publish({ title, alias, listed, content, summary, tags, draft }: { title: string, listed: boolean, content: string, summary: string, tags: string[], draft: boolean, alias?: string }) {
  const { data, error } = await client.feed.index.post({
    title,
    alias,
    content,
    summary,
    tags,
    listed,
    draft
  }, {
    headers: headersWithAuth()
  })
  if (error) {
    alert(error.value)
  }
  if (data && typeof data != 'string') {
    alert('发布成功')
    Cache.with().clear()
    window.location.href = '/feed/' + data.insertedId
  }
}

async function update({ id, title, alias, content, summary, tags, listed, draft }: { id: number, listed: boolean, title?: string, alias?: string, content?: string, summary?: string, tags?: string[], draft?: boolean }) {
  const { error } = await client.feed({ id }).post({
    title,
    alias,
    content,
    summary,
    tags,
    listed,
    draft
  }, {
    headers: headersWithAuth()
  })
  if (error) {
    alert(error.value)
  } else {
    alert('更新成功')
    Cache.with(id).clear()
    window.location.href = '/feed/' + id
  }
}

function uploadImage(file: File, onSuccess: (url: string) => void) {
  client.storage.index.post({
    key: file.name,
    file: file
  }, {
    headers: headersWithAuth()
  }).then(({ data, error }) => {
    if (error) {
      alert('上传失败' + error.value)
    }
    if (data) {
      onSuccess(data)
    }
  })
    .catch((e: any) => {
      console.error(e)
      alert('上传失败' + e.message)
    })
}

const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
  // Access the clipboard data using event.clipboardData
  const clipboardData = event.clipboardData;
  // only if clipboard payload is file
  if (clipboardData.files.length === 1) {
    const myfile = clipboardData.files[0] as File;
    uploadImage(myfile, (url) => {
      document.execCommand(
        "insertText",
        false,
        `![${myfile.name}](${url})\n`
      );
    })
    event.preventDefault();
  }
};



// 写作页面
export function WritingPage({ id }: { id?: number }) {
  const cache = Cache.with(id)
  const [title, setTitle] = useState(cache.get("title"))
  const [summary, setSummary] = useState(cache.get("summary"))
  const [tags, setTags] = useState(cache.get("tags"))
  const [alias, setAlias] = useState(cache.get("alias"))
  const [draft, setDraft] = useState(false)
  const [listed, setListed] = useState(true)
  const [data, setData] = useState<string>(cache.get("content") ?? "")
  function publishButton() {
    const tagsplit = tags.split('#').filter(tag => tag !== '').map(tag => tag.trim()) || []
    const content = data
    if (id != undefined) {
      update({ id, title, content, summary, alias, tags: tagsplit, draft, listed })
    } else {
      if (!title) {
        alert('标题不能为空')
        return
      }
      if (!content) {
        alert('内容不能为空')
        return
      }
      publish({ title, content, summary, tags: tagsplit, draft, alias, listed })
    }
  }
  useEffect(() => {
    console.log(id)
    if (id) {
      client.feed({ id }).get({
        headers: headersWithAuth()
      }).then(({ data }) => {
        if (data && typeof data !== 'string') {
          if (data.title)
            setTitle(data.title)
          if (data.hashtags)
            setTags(data.hashtags.map(({ name }) => `#${name}`).join(' '))
          if (data.alias)
            setAlias(data.alias)
          setListed(data.listed === 1)
          setData(data.content)
          setDraft(data.draft === 1)
          setSummary(data.summary)
        }
      })
    }
  }, [])

  return (
    <Padding>
      <div onDragOver={e => { e.preventDefault() }} onDragLeave={e => { e.preventDefault() }} onDrop={e => {
        e.preventDefault()
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i]
          uploadImage(file, (url) => {
            const textInput: HTMLInputElement | null = document.querySelector('.w-md-editor-text-input');
            if (!textInput) return;
            textInput.focus();
            document.execCommand(
              "insertText",
              false,
              `![${file.name}](${url})\n`
            );
          })
        }
      }} className='flex flex-row justify-start'>
        <div className='xl:basis-1/4 transition-all duration-300' />
        <div className='writeauto xl:basis-11/12 pb-8'>
          <div className='bg-white rounded-2xl shadow-xl shadow-neutral-200 p-4'>
            <div className='visible md:hidden mb-8'>
              <Input id="title" value={title} setValue={setTitle} placeholder='标题' />
              <Input id="summary" value={summary} setValue={setSummary} placeholder='摘要' className='mt-4' />
              <Input id="tags" value={tags} setValue={setTags} placeholder='标签' className='mt-4' />
              <Input id="alias" value={alias} setValue={setAlias} placeholder='别名' className='mt-4' />
              <div className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4' onClick={() => setDraft(!draft)}>
                <p>仅自己可见</p>
                <Checkbox id="draft" value={draft} setValue={setDraft} placeholder='草稿' />
              </div>
              <div className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4' onClick={() => setListed(!listed)}>
                <p>列出在文章中</p>
                <Checkbox id="listed" value={listed} setValue={setListed} placeholder='列出' />
              </div>
            </div>
            <div className='mx-4 my-2 md:mx-0 md:my-0'>
              <MDEditor height={500} value={data} onPaste={handlePaste} onChange={(data) => {
                cache.set('content', data ?? '')
                setData(data ?? '')
              }} />
            </div>
          </div>
          <div className='visible md:hidden flex flex-row justify-center mt-8'>
            <button onClick={publishButton} className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-neutral-200'>发布</button>
          </div>
        </div>
        <div className='hidden md:visible basis-1/2 md:basis-1/4 md:flex flex-col'>
          <div className='fixed'>
            <div className='bg-white rounded-2xl shadow-xl shadow-neutral-200 p-4 my-8 mx-8'>
              <Input id="title" value={title} setValue={setTitle} placeholder='标题' />
              <Input id="summary" value={summary} setValue={setSummary} placeholder='摘要' className='mt-4' />
              <Input id="tags" value={tags} setValue={setTags} placeholder='标签' className='mt-4' />
              <Input id="alias" value={alias} setValue={setAlias} placeholder='别名' className='mt-4' />
              <div className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4' onClick={() => setDraft(!draft)}>
                <p>仅自己可见</p>
                <Checkbox id="draft" value={draft} setValue={setDraft} placeholder='草稿' />
              </div>
              <div className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4' onClick={() => setListed(!listed)}>
                <p>列出在文章中</p>
                <Checkbox id="listed" value={listed} setValue={setListed} placeholder='列出' />
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

type Keys = 'title' | 'content' | 'tags' | 'summary' | 'draft' | 'alias' | 'listed'
const keys: Keys[] = ['title', 'content', 'tags', 'summary', 'draft', 'alias', 'listed']
class Cache {
  static with(id?: number) {
    return new Cache(id)
  }
  private id: string
  constructor(id?: number) {
    this.id = `${id ?? 'new'}`
  }
  public get(key: Keys) {
    return localStorage.getItem(`${this.id}/${key}`) ?? ''
  }
  public set(key: Keys, value: string) {
    localStorage.setItem(`${this.id}/${key}`, value)
  }
  clear() {
    keys.forEach(key => {
      localStorage.removeItem(`${this.id}/${key}`)
    })
  }
}