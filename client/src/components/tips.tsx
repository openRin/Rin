import { useTranslation } from "react-i18next";
import { Button } from "./button";

export function Tips({ value, type = 'tips' }: { value: string, type?: 'note' | 'tips' | 'warn' | 'error' | 'info' | 'important' }) {
    const { t } = useTranslation();
    let className = ""
    switch (type) {
        case 'note':
            className = "markdown-alert-note"
            break;
        case 'tips':
            className = "markdown-alert-tip"
            break;
        case 'warn':
            className = "markdown-alert-warn"
            break;
        case 'error':
            className = "markdown-alert-caution"
            break;
        case 'info':
            className = "markdown-alert-info"
            break;
        case 'important':
            className = "markdown-alert-important"
            break;
    }

    return (
        <div className={`flex flex-col items-start justify-center space-y-2 ${className} p-4 rounded-xl`}>
            <p className="markdown-alert-title"> {type.toUpperCase()} </p>
            <p className="text-sm">
                {t(value)}
            </p>
        </div>
    );
}

export function TipsPage({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
    return (
        <div className="w-full flex flex-row justify-center ani-show">
            <div className="flex flex-col wauto rounded-2xl bg-w m-2 p-6 items-center justify-center space-y-2">
                <h1 className="text-xl font-bold t-primary"> Oops! </h1>
                {children}
                <Button
                    title={t("index.back")}
                    onClick={() => (window.location.href = "/")}
                />
            </div>
        </div>
    );
}
