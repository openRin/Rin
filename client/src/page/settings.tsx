import { ChangeEvent, useContext, useEffect, useRef, useState } from "react";
import { client } from "../main.tsx";
import { headersWithAuth } from "../utils/auth.ts";
import Modal from "react-modal";
import * as Switch from '@radix-ui/react-switch';
import '../utils/thumb.css';
import ReactLoading from "react-loading";
import { ClientConfigContext, ConfigWrapper, ServerConfigContext } from "../state/config.tsx";
import { useTranslation } from "react-i18next";


export function Settings() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgList, setMsgList] = useState<{ title: string, reason: string }[]>([]);
    const [clientLoading, setClientLoading] = useState(true);
    const [serverLoading, setServerLoading] = useState(true);
    const [clientConfig, setClientConfig] = useState<ConfigWrapper>(new ConfigWrapper({}));
    const [serverConfig, setServerConfig] = useState<ConfigWrapper>(new ConfigWrapper({}));
    const ref = useRef(false);


    useEffect(() => {
        if (ref.current) return;
        client.config({
            type: 'client'
        }).get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data != 'string') {
                sessionStorage.setItem('config', JSON.stringify(data));
                const config = new ConfigWrapper(data)
                setClientConfig(config)
            }
        }).catch((err: any) => {
            alert(t('settings.get_config_failed$message', { message: err.message }))
        }).finally(() => {
            setClientLoading(false);
        })
        client.config({
            type: 'server'
        }).get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data != 'string') {
                const config = new ConfigWrapper(data)
                setServerConfig(config)
            }
        }).catch((err) => {
            alert(t('settings.get_config_failed$message', { message: err.message }))
        }).finally(() => {
            setServerLoading(false);
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
                    setMsg(t('settings.import_success$success$skipped', { success: data.success, skipped: data.skipped }))
                    setMsgList(data.skippedList)
                    setIsOpen(true);
                }
            }).catch((err) => {
                alert(t('settings.import_failed$message', { message: err.message }))
            })
        }
    }

    return (
        <div className="flex flex-col justify-center items-center">
            <ServerConfigContext.Provider value={serverConfig}>
                <ClientConfigContext.Provider value={clientConfig}>
                    <main className="wauto rounded-2xl bg-w m-2 p-6" aria-label="正文">
                        <div className="flex flex-row items-center space-x-2">
                            <h1 className="text-2xl font-bold t-primary">
                                {t('settings.title')}
                            </h1>
                            {(clientLoading || serverLoading) && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                        </div>
                        <div className="flex flex-col items-start mt-4">
                            <ItemSwitch title={t('settings.rss.title')} description={t('settings.rss.desc')} type="client" configKey="rss" />
                            <ItemSwitch title={t('settings.friend.apply.title')} description={t('settings.friend.apply.desc')} type="client" configKey="friend_apply_enable" defaultValue={true} />
                            <ItemSwitch title={t('settings.friend.health.title')} description={t('settings.friend.health.desc')} type="server" configKey="friend_crontab" defaultValue={true} />
                            <ItemInput title={t('settings.friend.health.ua.title')} description={t('settings.friend.health.ua.desc')} type="server" configKey="friend_ua" configKeyTitle="User-Agent" defaultValue="Rin-Check/0.1.0" />
                            <ItemButton title={t('settings.cache.clear.title')} description={t('settings.cache.clear.desc')} buttonTitle={t('clear')} onConfirm={async () => {
                                await client.config.cache.delete(undefined, {
                                    headers: headersWithAuth()
                                })
                                    .then(({ error }: { error: any }) => {
                                        if (error) {
                                            alert(t('settings.cache.clear_failed$message', { message: error.message }))
                                        }
                                    })
                            }} alertTitle={t('settings.cache.clear.confirm.title')} alertDescription={t('settings.cache.clear.confirm.desc')} />
                            <ItemWithUpload title={t('settings.wordpress.title')} description={t('settings.wordpress.desc')}
                                onFileChange={onFileChange} />
                        </div>
                    </main>
                </ClientConfigContext.Provider>
            </ServerConfigContext.Provider>
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
                        background: 'transparent',
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000
                    }
                }}
            >
                <div className="flex flex-col items-start p-4 bg-w">
                    <h1 className="text-2xl font-bold t-primary">
                        {t('settings.import_result')}
                    </h1>
                    <p className="text-base dark:text-white">
                        {msg}
                    </p>
                    <div className="flex flex-col items-start w-full">
                        <p className="text-base font-bold dark:text-white mt-2">
                            {t('settings.import_skipped')}
                        </p>
                        <ul className="flex flex-col items-start max-h-64 overflow-auto w-full">
                            {msgList.map((msg, idx) => (
                                <p key={idx} className="text-sm dark:text-white">
                                    {t('settings.import_skipped_item$title$reason', { title: msg.title, reason: msg.reason })}
                                </p>
                            ))}
                        </ul>
                    </div>
                    <div className="w-full flex flex-col items-center mt-4">
                        <button onClick={() => {
                            setIsOpen(false);
                        }} className="bg-theme text-white rounded-xl px-8 py-2 h-min">
                            {t('close')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function ItemSwitch({ title, description, type, defaultValue = false, configKey }: { title: string, description: string, defaultValue?: boolean, configKey: string, type: 'client' | 'server' }) {
    const config = type === 'client' ? useContext(ClientConfigContext) : useContext(ServerConfigContext);
    const [checked, setChecked] = useState(defaultValue);
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();
    useEffect(() => {
        const value = config?.get(configKey);
        if (value !== undefined) {
            setChecked(value);
        }
    }, [config]);
    function updateConfig(type: 'client' | 'server', key: string, value: any) {
        const checkedValue = checked
        setChecked(!checkedValue);
        setLoading(true);
        client.config({
            type
        }).post({
            [key]: value
        }, {
            headers: headersWithAuth()
        }).then(({ error }: { error: any }) => {
            if (error) {
                setChecked(checkedValue);
            }
            if (type === 'client') {
                const config = sessionStorage.getItem('config')
                if (config) {
                    sessionStorage.setItem('config', JSON.stringify({ ...JSON.parse(config), [key]: value }));
                } else {
                    sessionStorage.setItem('config', JSON.stringify({ [key]: value }));
                }
            }
            setLoading(false);
        }).catch((err) => {
            alert(t('settings.update_failed$message', { message: err.message }))
            setChecked(checkedValue);
            setLoading(false);
        })
    }
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
                <div className="flex flex-row items-center justify-center space-x-4">
                    {loading && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                    <Switch.Root className="SwitchRoot" checked={checked} onCheckedChange={() => {
                        updateConfig(type, configKey, !checked);
                    }}>
                        <Switch.Thumb className="SwitchThumb" />
                    </Switch.Root>
                </div>
            </div>
        </div >
    );
}

function ItemInput({ title, configKeyTitle, description, type, defaultValue, configKey }: { title: string, description: string, defaultValue?: string, configKeyTitle: string, configKey: string, type: 'client' | 'server' }) {
    const config = type === 'client' ? useContext(ClientConfigContext) : useContext(ServerConfigContext);
    const [value, setValue] = useState(defaultValue);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();
    useEffect(() => {
        const value = config?.get(configKey);
        if (value !== undefined) {
            setValue(value);
        }
    }, [config]);
    function updateConfig(type: 'client' | 'server', key: string, value: any) {
        setLoading(true);
        client.config({
            type
        }).post({
            [key]: value
        }, {
            headers: headersWithAuth()
        }).then(() => {
            if (type === 'client') {
                const config = sessionStorage.getItem('config')
                if (config) {
                    sessionStorage.setItem('config', JSON.stringify({ ...JSON.parse(config), [key]: value }));
                } else {
                    sessionStorage.setItem('config', JSON.stringify({ [key]: value }));
                }
            }
            setLoading(false);
        }).catch((err) => {
            alert(t('settings.update_failed$message', { message: err.message }))
            setValue(config?.get(configKey) || defaultValue);
            setLoading(false);
        })
    }
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
                <div className="flex flex-row items-center justify-center space-x-4">
                    {loading && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                    <Button title={t('update.title')} onClick={() => {
                        setIsOpen(true);
                    }} />
                </div>
            </div>
            <Modal isOpen={isOpen}
                shouldCloseOnOverlayClick={true}
                shouldCloseOnEsc={true}
                onRequestClose={() => { setIsOpen(false); }}
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
                        background: 'transparent',
                        width: '80%',
                        maxWidth: '40em'
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        zIndex: 1000
                    }
                }}
            >
                <div className="flex flex-col items-start p-4 bg-w space-y-4 w-full">
                    <h1 className="text-2xl font-bold t-primary">
                        {t('update$sth', { sth: configKeyTitle })}
                    </h1>
                    <textarea placeholder={defaultValue || configKeyTitle} value={value} onChange={(e) => {
                        setValue(e.target.value);
                    }} className="rounded-xl p-2 bg-secondary min-h-32 w-full" />
                    <div className="w-full flex flex-row items-center justify-center space-x-2 mt-4">
                        <Button onClick={() => {
                            setIsOpen(false);
                            updateConfig(type, configKey, value);
                        }} title={t('confirm')} />
                        <Button secondary onClick={() => {
                            setIsOpen(false);
                        }} title={t('cancel')} />
                    </div>
                </div>
            </Modal>
        </div >
    );
}

function ItemButton({
    title,
    description,
    buttonTitle,
    onConfirm,
    alertTitle,
    alertDescription
}:
    {
        title: string,
        description: string,
        buttonTitle: string,
        onConfirm: () => Promise<void>,
        alertTitle: string,
        alertDescription: string,
    }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
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
                <div className="flex flex-row items-center justify-center space-x-4">
                    {loading && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                    <Button title={buttonTitle} onClick={() => {
                        setIsOpen(true);
                    }} />
                </div>
            </div>
            <Modal isOpen={isOpen}
                shouldCloseOnOverlayClick={true}
                shouldCloseOnEsc={true}
                onRequestClose={() => { setIsOpen(false); }}
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
                        background: 'transparent',
                        maxWidth: '40em'
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        zIndex: 1000
                    }
                }}
            >
                <div className="flex flex-col items-start p-4 bg-w space-y-4 w-full">
                    <h1 className="text-2xl font-bold t-primary">
                        {alertTitle}
                    </h1>
                    <p className="text-base t-primary">
                        {alertDescription}
                    </p>
                    <div className="w-full flex flex-row items-center justify-center space-x-2 mt-4">
                        <Button onClick={async () => {
                            setIsOpen(false);
                            setLoading(true);
                            await onConfirm();
                            setLoading(false);
                        }} title={t('confirm')} />
                        <Button secondary onClick={() => {
                            setIsOpen(false);
                        }} title={t('cancel')} />
                    </div>
                </div>
            </Modal>
        </div >
    );
}

function ItemWithUpload({ title, description, onFileChange }: { title: string, description: string, onFileChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();
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
                <Button onClick={() => {
                    inputRef.current?.click();
                }} title={t('upload.title')} />
            </div>
        </div>
    );
}

function Button({ title, onClick, secondary = false }: { title: string, secondary?: boolean, onClick: () => void }) {
    return (
        <button onClick={onClick} className={`${secondary ? "bg-secondary t-primary" : "bg-theme text-white"} rounded-full px-4 py-2 h-min`}>
            {title}
        </button>
    );
}