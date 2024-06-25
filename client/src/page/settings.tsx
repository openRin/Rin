import { ChangeEvent, useEffect, useRef, useState } from "react";
import { client } from "../main.tsx";
import { headersWithAuth } from "../utils/auth.ts";
import Modal from "react-modal";
import * as Switch from '@radix-ui/react-switch';
import '../utils/thumb.css';


export function Settings() {
    const [isOpen, setIsOpen] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgList, setMsgList] = useState<{ title: string, reason: string }[]>([]);
    const [checked, setChecked] = useState(false);
    const ref = useRef(false);

    function updateConfig(type: 'client' | 'server', key: string, value: any) {
        client.config({
            type
        }).post({
            [key]: value
        }, {
            headers: headersWithAuth()
        }).then(() => {
            const config = sessionStorage.getItem('config')
            if (config) {
                sessionStorage.setItem('config', JSON.stringify({ ...JSON.parse(config), [key]: value }));
            } else {
                sessionStorage.setItem('config', JSON.stringify({ [key]: value }));
            }
        }).catch((err) => {
            alert(`更新失败: ${err.message}`)
        })
    }
    useEffect(() => {
        if (ref.current) return;
        client.config({
            type: 'client'
        }).get().then(({ data }) => {
            if (data && typeof data != 'string') {
                setChecked(data['rss']);
            }
        }).catch((err) => {
            alert(`获取配置失败: ${err.message}`)
        })
        ref.current = true;
    }, []);

    function onFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            client.wp.post({
                data: file,
            }, {
                headers: headersWithAuth()
            }).then(({ data }) => {
                if (data && typeof data != 'string') {
                    setMsg(`导入成功，成功导入 ${data.success} 篇文章，跳过 ${data.skipped} 篇文章`)
                    setMsgList(data.skippedList)
                    setIsOpen(true);
                }
            }).catch((err) => {
                alert(`导入失败: ${err.message}`)
            })
        }
    }

    return (
        <div className="flex flex-col justify-center items-center">
            <main className="wauto rounded-2xl bg-w m-2 p-6" aria-label="正文">
                <div className="flex flex-row items-center">
                    <h1 className="text-2xl font-bold t-primary">
                        设置
                    </h1>
                </div>
                <div className="flex flex-col items-start mt-4">
                    <ItemSwitch title="RSS 订阅链接" description="启用站点底部 RSS 订阅链接" checked={checked} onChange={() => {
                        setChecked(!checked);
                        updateConfig('client', 'rss', !checked);
                    }} />
                    <ItemWithUpload title="从 WordPress 导入" description="上传 WordPress 导出的 XML 文件"
                        onFileChange={onFileChange} />
                </div>
            </main>
            <Modal isOpen={isOpen}

                style={{
                    content: {
                        top: '50%',
                        left: '50%',
                        right: 'auto',
                        bottom: 'auto',
                        marginRight: '-50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '0',
                        border: 'none',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'white',
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000
                    }
                }}
            >
                <div className="flex flex-col items-start p-4">
                    <h1 className="text-2xl font-bold t-primary">
                        导入结果
                    </h1>
                    <p className="text-base dark:text-white">
                        {msg}
                    </p>
                    <div className="flex flex-col items-start w-full">
                        <p className="text-base font-bold dark:text-white mt-2">
                            跳过的文章
                        </p>
                        <ul className="flex flex-col items-start max-h-64 overflow-auto w-full">
                            {msgList.map((msg, idx) => (
                                <p key={idx} className="text-sm dark:text-white">
                                    《{msg.title}》 - {msg.reason}
                                </p>
                            ))}
                        </ul>
                    </div>
                    <div className="w-full flex flex-col items-center mt-4">
                        <button onClick={() => {
                            setIsOpen(false);
                        }} className="bg-theme text-white rounded-xl px-8 py-2 h-min">
                            确定
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function ItemSwitch({ title, description, checked, onChange }: { title: string, description: string, checked: boolean, onChange: (checked: boolean) => void }) {
    return (
        <div className="flex flex-col w-full items-start mt-4">
            <div className="flex flex-row justify-between w-full items-center">
                <div className="flex flex-col">
                    <p className="text-lg font-bold dark:text-white">
                        {title}
                    </p>
                    <p className="text-xs text-neutral-500">
                        {description}
                    </p>
                </div>
                <Switch.Root className="SwitchRoot" checked={checked} onCheckedChange={onChange}>
                    <Switch.Thumb className="SwitchThumb" />
                </Switch.Root>
            </div>
        </div>
    );
}

function ItemWithUpload({ title, description, onFileChange }: { title: string, description: string, onFileChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="flex flex-col w-full items-start mt-4">
            <div className="flex flex-row justify-between w-full items-center">
                <div className="flex flex-col">
                    <p className="text-lg font-bold dark:text-white">
                        {title}
                    </p>
                    <p className="text-xs text-neutral-500">
                        {description}
                    </p>
                </div>
                <input ref={inputRef} type="file" className="hidden" accept="application/xml"
                    onChange={onFileChange} />
                <button onClick={() => {
                    inputRef.current?.click();
                }} className="bg-theme text-white rounded-xl px-8 py-2 h-min">
                    上传
                </button>
            </div>
        </div>
    );
}