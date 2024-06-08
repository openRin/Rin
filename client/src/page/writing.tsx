import "@uiw/react-markdown-preview/markdown.css";
import MDEditor, { ContextStore, getCommands, TextAreaTextApi } from '@uiw/react-md-editor';
import "@uiw/react-md-editor/markdown-editor.css";
import { useEffect, useRef, useState } from 'react';
import { Checkbox, Input } from '../components/input';
import { Padding } from '../components/padding';
import { client } from '../main';
import { headersWithAuth } from '../utils/auth';
import { Helmet } from 'react-helmet'
import { siteName } from "../utils/constants";

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

function uploadImageButton() {
  const uploadRef = useRef<HTMLInputElement>(null)
  const upChange = (event: any) => {
    let imgfile = event.currentTarget.files[0];///获得input的第一个图片
    if (imgfile.size > 5 * 1024000) {
      alert('图片不能超过 5MB')
      uploadRef.current!.value = ''
    }
    else {
      uploadImage(imgfile, (url) => {
        const textInput: HTMLInputElement | null = document.querySelector('.w-md-editor-text-input');
        if (!textInput) return;
        textInput.focus();
        document.execCommand(
          "insertText",
          false,
          `![${imgfile.name}](${url})\n`
        );
      })
    }
  }
  return {
    name: 'uploadImage',
    keyCommand: 'uploadImage',
    buttonProps: { 'aria-label': 'Upload Image' },
    icon: (
      <>
        <input ref={uploadRef} onChange={upChange} className='hidden' type="file" accept="image/gif,image/jpeg,image/jpg,image/png" />
        <i className="ri-image-add-line" />
      </>
    ),
    execute: (_state: ContextStore, _api: TextAreaTextApi) => {
      uploadRef.current?.click()
    },
  };
}


// 写作页面
export function WritingPage({ id }: { id?: number }) {
  const cache = Cache.with(id)
  const [title, setTitle] = useState(cache.get("title"))
  const [summary, setSummary] = useState(cache.get("summary"))
  const [tags, setTags] = useState(cache.get("tags"))
  const [alias, setAlias] = useState(cache.get("alias"))
  const [draft, setDraft] = useState(false)
  const [listed, setListed] = useState(true)
  const [content, setContent] = useState<string>(cache.get("content") ?? "")
  function publishButton() {
    const tagsplit = tags.split('#').filter(tag => tag !== '').map(tag => tag.trim()) || []
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
          if (title == '' && data.title)
            setTitle(data.title)
          if (tags == '' && data.hashtags)
            setTags(data.hashtags.map(({ name }) => `#${name}`).join(' '))
          if (alias == '' && data.alias)
            setAlias(data.alias)
          if (content == '')
            setContent(data.content)
          if (summary == '')
            setSummary(data.summary)
          setListed(data.listed === 1)
          setDraft(data.draft === 1)
        }
      })
    }
  }, [])

  return (
    <Padding>
      <Helmet>
        <title>{`${"写作"} - ${process.env.NAME}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={"写作"} />
        <meta property="og:image" content={process.env.AVATAR} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
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
      }} className='flex flex-row justify-start t-primary'>
        <div className='xl:basis-1/4 transition-all duration-300' />
        <div className='writeauto xl:basis-11/12 pb-8'>
          <div className='bg-w rounded-2xl shadow-xl shadow-color p-4'>
            <div className='visible md:hidden mb-8'>
              <Input id={id} name="title" value={title} setValue={setTitle} placeholder='标题' />
              <Input id={id} name="summary" value={summary} setValue={setSummary} placeholder='摘要' className='mt-4' />
              <Input id={id} name="tags" value={tags} setValue={setTags} placeholder='标签' className='mt-4' />
              <Input id={id} name="alias" value={alias} setValue={setAlias} placeholder='别名' className='mt-4' />
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
              <MDEditor height={500} value={content} onPaste={handlePaste}
                commands={[
                  ...getCommands(),
                  uploadImageButton()
                ]}
                onChange={(data) => {
                  cache.set('content', data ?? '')
                  setContent(data ?? '')
                }} />
            </div>
          </div>
          <div className='visible md:hidden flex flex-row justify-center mt-8'>
            <button onClick={publishButton} className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-color'>发布</button>
          </div>
        </div>
        <div className='hidden md:visible basis-1/2 md:basis-1/4 md:flex flex-col'>
          <div className='fixed'>
            <div className='bg-w rounded-2xl shadow-xl shadow-color p-4 my-8 mx-8'>
              <Input id={id} name="title" value={title} setValue={setTitle} placeholder='标题' />
              <Input id={id} name="summary" value={summary} setValue={setSummary} placeholder='摘要' className='mt-4' />
              <Input id={id} name="tags" value={tags} setValue={setTags} placeholder='标签' className='mt-4' />
              <Input id={id} name="alias" value={alias} setValue={setAlias} placeholder='别名' className='mt-4' />
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
              <button onClick={publishButton} className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-color'>发布</button>
            </div>
          </div>
        </div>
      </div>
    </Padding>
  )
}

export type Keys = 'title' | 'content' | 'tags' | 'summary' | 'draft' | 'alias' | 'listed'
const keys: Keys[] = ['title', 'content', 'tags', 'summary', 'draft', 'alias', 'listed']
export class Cache {
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
    if (value === '')
      localStorage.removeItem(`${this.id}/${key}`)
    else
      localStorage.setItem(`${this.id}/${key}`, value)
  }
  clear() {
    keys.forEach(key => {
      localStorage.removeItem(`${this.id}/${key}`)
    })
  }
}