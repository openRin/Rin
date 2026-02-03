import * as Switch from '@radix-ui/react-switch';
import { ChangeEvent, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import Modal from "react-modal";
import { Button } from "../components/button.tsx";
import { useAlert, useConfirm } from "../components/dialog.tsx";
import { client, endpoint, oauth_url } from "../main.tsx";
import {
    ClientConfigContext,
    ConfigWrapper,
    defaultClientConfig,
    defaultClientConfigWrapper,
    defaultServerConfig,
    defaultServerConfigWrapper,
    ServerConfigContext
} from "../state/config.tsx";
import { headersWithAuth } from "../utils/auth.ts";
import '../utils/thumb.css';


export function Settings() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgList, setMsgList] = useState<{ title: string, reason: string }[]>([]);
    const [clientLoading, setClientLoading] = useState(true);
    const [serverLoading, setServerLoading] = useState(true);
    const [clientConfig, setClientConfig] = useState<ConfigWrapper>(defaultClientConfigWrapper);
    const [serverConfig, setServerConfig] = useState<ConfigWrapper>(defaultServerConfigWrapper);
    const ref = useRef(false);
    const { showAlert, AlertUI } = useAlert();


    useEffect(() => {
        if (ref.current) return;
        client.config.get('client', {
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data) {
                sessionStorage.setItem('config', JSON.stringify(data));
                const config = new ConfigWrapper(data, defaultClientConfig)
                setClientConfig(config)
            }
        }).catch((err: any) => {
            showAlert(t('settings.get_config_failed$message', { message: err.message }))
        }).finally(() => {
            setClientLoading(false);
        })
        client.config.get('server', {
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data) {
                const config = new ConfigWrapper(data, defaultServerConfig)
                setServerConfig(config)
            }
        }).catch((err) => {
            showAlert(t('settings.get_config_failed$message', { message: err.message }))
        }).finally(() => {
            setServerLoading(false);
        })
        ref.current = true;
    }, []);

    async function handleFaviconChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
            if (file.size > MAX_FILE_SIZE) {
                showAlert(
                    t("upload.failed$size", {
                        size: MAX_FILE_SIZE / 1024 / 1024,
                    }),
                );
                return;
            }
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${endpoint}/favicon`, {
                method: 'POST',
                headers: headersWithAuth(),
                body: formData,
                credentials: 'include',
            });
            if (response.ok) {
                showAlert(t("settings.favicon.update.success"));
            } else {
                showAlert(
                    t("settings.favicon.update.failed$message", {
                        message: response.statusText,
                    }),
                );
            }
        }
    }

    async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const xmlContent = event.target?.result as string;
                await client.wp.import(xmlContent, {
                    headers: headersWithAuth()
                }).then(({ data, error }) => {
                    if (data) {
                        setMsg(t('settings.import_success$success$skipped', { success: data.imported, skipped: 0 }))
                        setMsgList([])
                        setIsOpen(true);
                    } else if (error) {
                        showAlert(t('settings.import_failed$message', { message: error.value }))
                    }
                })
            };
            reader.readAsText(file);
        }
    }

    return (
        <div className="flex flex-col justify-center items-center">
            <ServerConfigContext.Provider value={serverConfig}>
                <ClientConfigContext.Provider value={clientConfig}>
                    <main className="wauto rounded-2xl bg-w m-2 p-6" aria-label={t("main_content")}>
                        <div className="flex flex-row items-center space-x-2">
                            <h1 className="text-2xl font-bold t-primary">
                                {t('settings.title')}
                            </h1>
                            {(clientLoading || serverLoading) && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                        </div>
                        <div className="flex flex-col items-start space-y-2">
                            <ItemTitle title={t('settings.friend.title')} />
                            <ItemSwitch title={t('settings.friend.apply.title')} description={t('settings.friend.apply.desc')} type="client" configKey="friend_apply_enable" />
                            <ItemSwitch title={t('settings.friend.health.title')} description={t('settings.friend.health.desc')} type="server" configKey="friend_crontab" />
                            <ItemInput title={t('settings.friend.health.ua.title')} description={t('settings.friend.health.ua.desc')} type="server" configKey="friend_ua" configKeyTitle="User-Agent" />
                            <ItemTitle title={t('settings.other.title')} />
                            <ItemSwitch title={t('settings.login.enable.title')} description={t('settings.login.enable.desc', { "url": oauth_url })} type="client" configKey="login.enabled" />
                            <ItemSwitch title={t('settings.comment.enable.title')} description={t('settings.comment.enable.desc')} type="client" configKey="comment.enabled" />
                            <ItemSwitch title={t('settings.counter.enable.title')} description={t('settings.counter.enable.desc')} type="client" configKey="counter.enabled" />
                            <ItemSwitch title={t('settings.rss.title')} description={t('settings.rss.desc')} type="client" configKey="rss" />
                            <ItemWithUpload
                                title={t("settings.favicon.title")}
                                description={t("settings.favicon.desc")}
                                // @see https://developers.cloudflare.com/images/transform-images/#supported-input-formats
                                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                                onFileChange={handleFaviconChange}
                            />
                            <ItemInput title={t('settings.footer.title')} description={t('settings.footer.desc')} type="client" configKey="footer" configKeyTitle="Footer HTML" />
                            <ItemButton title={t('settings.cache.clear.title')} description={t('settings.cache.clear.desc')} buttonTitle={t('clear')} onConfirm={async () => {
                                await client.config.clearCache({
                                    headers: headersWithAuth()
                                })
                                    .then(({ error }) => {
                                        if (error) {
                                            showAlert(t('settings.cache.clear_failed$message', { message: error.value }))
                                        }
                                    })
                            }} alertTitle={t('settings.cache.clear.confirm.title')} alertDescription={t('settings.cache.clear.confirm.desc')} />
                            <ItemWithUpload title={t('settings.wordpress.title')} description={t('settings.wordpress.desc')}
                                accept="application/xml"
                                onFileChange={onFileChange} />
                            <AISummarySettings />
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
            <AlertUI />
        </div>
    );
}

function ItemTitle({ title }: { title: string }) {
    return (
        <h1 className="text-sm t-primary pt-4">
            {title}
        </h1>
    );
}

function ItemSwitch({ title, description, type, configKey }: { title: string, description: string, configKey: string, type: 'client' | 'server' }) {
    const config = type === 'client' ? useContext(ClientConfigContext) : useContext(ServerConfigContext);
    const defaultValue = config?.default<boolean>(configKey);
    const [checked, setChecked] = useState(defaultValue);
    const [loading, setLoading] = useState(false);
    const { showAlert, AlertUI } = useAlert();
    const { t } = useTranslation();
    useEffect(() => {
        const value = config?.get<boolean>(configKey);
        if (value !== undefined) {
            setChecked(value);
        }
    }, [config]);
    function updateConfig(type: 'client' | 'server', key: string, value: any) {
        const checkedValue = checked
        setChecked(!checkedValue);
        setLoading(true);
        client.config.update(type, {
            [key]: value
        }, {
            headers: headersWithAuth()
        }).then(({ error }) => {
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
        }).catch((err: any) => {
            showAlert(t('settings.update_failed$message', { message: err.message }))
            setChecked(checkedValue);
            setLoading(false);
        })
    }
    return (
        <div className="flex flex-col w-full items-start">
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
            <AlertUI />
        </div >
    );
}

function ItemInput({ title, configKeyTitle, description, type, configKey }: { title: string, description: string, configKeyTitle: string, configKey: string, type: 'client' | 'server' }) {
    const config = type === 'client' ? useContext(ClientConfigContext) : useContext(ServerConfigContext);
    const defaultValue = config?.default<string>(configKey);
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const { showAlert, AlertUI } = useAlert();

    const { t } = useTranslation();
    useEffect(() => {
        const value = config?.get<string>(configKey);
        if (value !== undefined) {
            setValue(value);
        }
    }, [config]);
    function updateConfig(type: 'client' | 'server', key: string, value: any) {
        setLoading(true);
        client.config.update(type, {
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
        }).catch((err: any) => {
            showAlert(t('settings.update_failed$message', { message: err.message }))
            setValue(config?.get<string>(configKey) || "");
            setLoading(false);
        })
    }
    return (
        <div className="flex flex-col w-full items-start">
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
                    }} className="rounded-xl p-2 bg-secondary min-h-32 w-full t-primary" />
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
            <AlertUI />
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
    const { showConfirm, ConfirmUI } = useConfirm();
    return (
        <div className="flex flex-col w-full items-start">
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
                    <Button title={buttonTitle} onClick={() => {
                        showConfirm(alertTitle, alertDescription, onConfirm);
                    }} />
                </div>
            </div>
            <ConfirmUI />
        </div >
    );
}

function ItemWithUpload({
    title,
    description,
    accept,
    onFileChange,
}: {
    title: string;
    description: string;
    onFileChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
    accept: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        setLoading(true);
        try {
            await onFileChange(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col w-full items-start">
            <div className="flex flex-row justify-between w-full items-center">
                <div className="flex flex-col">
                    <p className="text-lg font-bold dark:text-white">{title}</p>
                    <p className="text-xs text-neutral-500">{description}</p>
                </div>
                <div className="flex flex-row items-center justify-center space-x-4">
                    {loading && (
                        <ReactLoading
                            width="1em"
                            height="1em"
                            type="spin"
                            color="#FC466B"
                        />
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        accept={accept}
                        onChange={handleFileChange}
                    />
                    <Button
                        onClick={() => {
                            inputRef.current?.click();
                        }}
                        title={t("upload.title")}
                    />
                </div>
            </div>
        </div>
    );
}

// AI Provider presets with their default API URLs
const AI_PROVIDER_PRESETS = [
    { value: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1' },
    { value: 'claude', label: 'Claude', url: 'https://api.anthropic.com/v1' },
    { value: 'gemini', label: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai' },
    { value: 'deepseek', label: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
    { value: 'zhipu', label: 'Zhipu', url: 'https://open.bigmodel.cn/api/paas/v4' }
];

const AI_MODEL_PRESETS: Record<string, string[]> = {
    openai: [
        // GPT-5 series (latest)
        'gpt-5.2',
        'gpt-5.1',
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'gpt-5-pro',
        // GPT-5 Codex series
        'gpt-5.1-codex',
        'gpt-5.1-codex-max',
        'gpt-5.1-codex-mini',
        'gpt-5-codex',
        // GPT-4 series
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        // Legacy models
        'gpt-3.5-turbo',
        'o3',
        'o3-mini',
        'o1',
        'o1-mini',
        'o1-preview'
    ],
    claude: [
        // Claude 4.5 series (latest)
        'claude-opus-4-5-20251101',
        'claude-sonnet-4-5-20250929',
        'claude-haiku-4-5-20251001',
        // Aliases for 4.5
        'claude-opus-4-5',
        'claude-sonnet-4-5',
        'claude-haiku-4-5',
        // Legacy Claude 3 series
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229'
    ],
    gemini: [
        // Gemini 3 series (latest)
        'gemini-3-pro-preview',
        'gemini-3-flash-preview',
        // Gemini 2.5 series
        'gemini-2.5-flash',
        'gemini-2.5-flash-preview-09-2025',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-lite-preview-09-2025',
        'gemini-2.5-pro',
        // Gemini 2.0 series
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
        'gemini-2.0-flash-exp',
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash-lite-001',
        // Legacy
        'gemini-1.5-pro',
        'gemini-1.5-flash'
    ],
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    zhipu: [
        // GLM-4 series (latest)
        'glm-4.7',
        'glm-4.6',
        'glm-4.5',
        // High performance/cost-effective models
        'glm-4.5-air',
        'glm-4.5-airx',
        'glm-4.5-flash',
        // Long context model
        'glm-4-long',
        // Vision models
        'glm-4.6v',
        'glm-4.1v-thinking-flashx',
        'glm-4.6v-flash',
        'glm-4.1v-thinking-flash',
        'glm-4v-flash',
        // Legacy models
        'glm-4',
        'glm-4-plus',
        'glm-4-air',
        'glm-4-flash',
        'glm-4-flash-250414',
        'glm-4-flashx-250414',
        'glm-3-turbo'
    ]
};

function AISummarySettings() {
    const { t } = useTranslation();
    const [enabled, setEnabled] = useState(false);
    const [provider, setProvider] = useState('openai');
    const [model, setModel] = useState('gpt-4o-mini');
    const [apiKey, setApiKey] = useState('');
    const [apiKeySet, setApiKeySet] = useState(false);
    const [apiUrl, setApiUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const { showAlert, AlertUI } = useAlert();

    // Load AI config from database via new API
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await fetch(`${endpoint}/ai-config`, {
                    headers: headersWithAuth()
                });
                if (response.ok) {
                    const data = await response.json() as {
                        enabled?: boolean;
                        provider?: string;
                        model?: string;
                        api_key_set?: boolean;
                        api_url?: string;
                    };
                    setEnabled(data.enabled ?? false);
                    setProvider(data.provider ?? 'openai');
                    setModel(data.model ?? 'gpt-4o-mini');
                    setApiKeySet(data.api_key_set ?? false);
                    setApiUrl(data.api_url ?? '');
                }
            } catch (err) {
                console.error('Failed to load AI config:', err);
            }
        };
        loadConfig();
    }, []);

    const updateConfig = async (updates: Record<string, any>) => {
        setLoading(true);
        try {
            const response = await fetch(`${endpoint}/ai-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headersWithAuth()
                },
                body: JSON.stringify(updates)
            });
            if (!response.ok) {
                const errorData = await response.text();
                console.error('AI config save error:', response.status, errorData);
                throw new Error(`Failed to save config: ${response.status} - ${errorData}`);
            }
        } catch (err: any) {
            showAlert(t('settings.update_failed$message', { message: err.message }));
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleToggleEnabled = async (checked: boolean) => {
        setEnabled(checked);
        // Reset unsaved changes when toggling AI feature on/off
        setHasUnsavedChanges(false);
        await updateConfig({ enabled: checked });
        // Refresh client config to update ai_summary.enabled in global state
        try {
            const { data } = await client.config.get('client', {
                headers: headersWithAuth()
            });
            if (data) {
                sessionStorage.setItem('config', JSON.stringify(data));
                // Trigger a storage event to notify other components
                window.dispatchEvent(new Event('storage'));
            }
        } catch (err) {
            console.error('Failed to refresh client config:', err);
        }
    };

    const handleProviderChange = (newProvider: string) => {
        setProvider(newProvider);
        const preset = AI_PROVIDER_PRESETS.find(p => p.value === newProvider);
        if (preset) {
            setApiUrl(preset.url);
            const models = AI_MODEL_PRESETS[newProvider];
            if (models && models.length > 0) {
                setModel(models[0]);
            }
        }
        setHasUnsavedChanges(true);
    };

    const handleSaveConfig = async () => {
        const preset = AI_PROVIDER_PRESETS.find(p => p.value === provider);
        await updateConfig({
            provider: provider,
            model: model,
            api_url: apiUrl || preset?.url,
            api_key: apiKey.trim() || undefined
        });
        setHasUnsavedChanges(false);
        if (apiKey.trim()) {
            setApiKeySet(true);
        }
        setApiKey('');
        showAlert(t('settings.ai_summary.save_success'));
    };

    const modelOptions = AI_MODEL_PRESETS[provider] || [];

    return (
        <>
            <ItemTitle title={t('settings.ai_summary.title')} />
            <div className="flex flex-col w-full items-start">
                <div className="flex flex-row justify-between w-full items-center">
                    <div className="flex flex-col">
                        <p className="text-lg font-bold dark:text-white">
                            {t('settings.ai_summary.enable.title')}
                        </p>
                        <p className="text-xs text-neutral-500">
                            {t('settings.ai_summary.enable.desc')}
                        </p>
                    </div>
                    <div className="flex flex-row items-center justify-center space-x-4">
                        {loading && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                        <Switch.Root className="SwitchRoot" checked={enabled} onCheckedChange={handleToggleEnabled}>
                            <Switch.Thumb className="SwitchThumb" />
                        </Switch.Root>
                    </div>
                </div>
            </div>

            {enabled && (
                <>
                    {/* Provider */}
                    <div className="flex flex-col w-full items-start">
                        <div className="flex flex-row justify-between w-full items-center">
                            <div className="flex flex-col">
                                <p className="text-lg font-bold dark:text-white">
                                    {t('settings.ai_summary.provider.title')}
                                </p>
                                <p className="text-xs text-neutral-500">
                                    {t('settings.ai_summary.provider.desc')}
                                </p>
                            </div>
                            <div className="flex flex-row items-center space-x-2">
                                <select
                                    value={provider}
                                    onChange={(e) => {
                                        handleProviderChange(e.target.value);
                                    }}
                                    className="rounded-lg px-3 py-1.5 bg-secondary t-primary text-sm w-40"
                                >
                                    {AI_PROVIDER_PRESETS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Model */}
                    <div className="flex flex-col w-full items-start">
                        <div className="flex flex-row justify-between w-full items-center">
                            <div className="flex flex-col">
                                <p className="text-lg font-bold dark:text-white">
                                    {t('settings.ai_summary.model.title')}
                                </p>
                                <p className="text-xs text-neutral-500">
                                    {t('settings.ai_summary.model.desc')}
                                </p>
                            </div>
                            <div className="flex flex-row items-center space-x-2">
                                <input
                                    list="model-options"
                                    value={model}
                                    onChange={(e) => {
                                    setModel(e.target.value);
                                    setHasUnsavedChanges(true);
                                    }}
                                    className="rounded-lg px-3 py-1.5 bg-secondary t-primary text-sm w-56"
                                    placeholder="选择或输入模型"
                                />
                                <datalist id="model-options">
                                    {modelOptions.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="flex flex-col w-full items-start">
                        <div className="flex flex-row justify-between w-full items-center">
                            <div className="flex flex-col">
                                <p className="text-lg font-bold dark:text-white">
                                    {t('settings.ai_summary.api_key.title')}
                                    {apiKeySet && <span className="ml-2 text-xs text-green-500">(✓ {t('settings.ai_summary.api_key.set')})</span>}
                                </p>
                                <p className="text-xs text-neutral-500">
                                    {t('settings.ai_summary.api_key.desc')}
                                </p>
                            </div>
                            <div className="flex flex-row items-center space-x-2">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => {
                                        setApiKey(e.target.value);
                                        setHasUnsavedChanges(true);
                                    }}
                                    placeholder={apiKeySet ? t('settings.ai_summary.api_key.placeholder_set') : "sk-..."}
                                    className="rounded-lg px-3 py-1.5 bg-secondary t-primary text-sm w-56"
                                />
                            </div>
                        </div>
                    </div>

                    {/* API URL */}
                    <div className="flex flex-col w-full items-start">
                        <div className="flex flex-row justify-between w-full items-center">
                            <div className="flex flex-col">
                                <p className="text-lg font-bold dark:text-white">
                                    {t('settings.ai_summary.api_url.title')}
                                </p>
                                <p className="text-xs text-neutral-500">
                                    {t('settings.ai_summary.api_url.desc')}
                                </p>
                            </div>
                            <div className="flex flex-row items-center space-x-2">
                                <input
                                    type="text"
                                    value={apiUrl}
                                    onChange={(e) => {
                                        setApiUrl(e.target.value);
                                        setHasUnsavedChanges(true);
                                    }}
                                    placeholder="https://api.openai.com/v1"
                                    className="rounded-lg px-3 py-1.5 bg-secondary t-primary text-sm w-64"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Save Button - only visible when there are unsaved configuration changes */}
            {hasUnsavedChanges && (
                <div className="flex flex-col w-full items-start">
                    <div className="flex flex-row justify-between w-full items-center">
                        <div className="flex flex-col">
                            <p className="text-lg font-bold dark:text-white">
                                {t('settings.ai_summary.save.title')}
                            </p>
                            <p className="text-xs text-neutral-500">
                                {t('settings.ai_summary.save.desc')}
                            </p>
                        </div>
                        <div className="flex flex-row items-center space-x-2">
                            {loading && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                            <Button
                                title={t('settings.ai_summary.save.button')}
                                onClick={handleSaveConfig}
                                disabled={loading}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-yellow-500 mt-1">
                        {t('settings.ai_summary.unsaved_changes')}
                    </p>
                </div>
            )}
            <AlertUI />
        </>
    );
}
