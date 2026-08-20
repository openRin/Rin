import { Modal } from "@rin/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonWithLoading } from "./button";

export type Confirm = {
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
}

export type Alert = {
    message: string;
    onConfirm: () => void;
}

export type ShowAlertType = (msg: string, onConfirm?: () => (Promise<void> | void)) => void;

export function useAlert() {
    const [alert, setAlert] = useState<Alert | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const close = () => {
        alert?.onConfirm()
        setIsOpen(false)
        setAlert(null)
    }
    const showAlert = (alert: string, onConfirm?: () => void) => {
        setAlert({
            message: alert,
            onConfirm: onConfirm ?? (() => { })
        })
        setIsOpen(true)
    }
    const { t } = useTranslation()
    const AlertUI = () => (
        <Modal
            isOpen={isOpen}
            shouldCloseOnOverlayClick={true}
            shouldCloseOnEsc={true}
            onRequestClose={close}
            contentLabel={t("alert")}
            size="sm"
            panelClassName="p-6"
        >
            <div className="flex w-full flex-col items-start space-y-4">
                <h1 className="text-xl font-bold tracking-[-0.02em] t-primary">
                    {t("alert")}
                </h1>
                <p className="text-base t-primary">
                    {alert?.message}
                </p>
                <div className="w-full flex flex-row items-center justify-center space-x-2 mt-4">
                    <Button onClick={close} title={t('confirm')} />
                </div>
            </div>
        </Modal>
    )
    return { showAlert, close, AlertUI }
}

export function useConfirm() {
    const [confirm, setConfirm] = useState<Confirm | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false);
    const close = () => {
        setConfirm(null)
        setIsOpen(false)
    }
    const showConfirm = (title: string, message: string, onConfirm?: () => Promise<void> | void) => {
        setConfirm({
            title,
            message,
            onConfirm: onConfirm ?? (() => { })
        })
        setIsOpen(true)
    }
    const { t } = useTranslation()
    const ConfirmUI = () => (
        <Modal
            isOpen={isOpen}
            shouldCloseOnOverlayClick={true}
            shouldCloseOnEsc={true}
            onRequestClose={close}
            contentLabel={confirm?.title ?? t("confirm")}
            size="sm"
            panelClassName="p-6"
        >
            <div className="flex w-full flex-col items-start space-y-4">
                <h1 className="text-xl font-bold tracking-[-0.02em] t-primary">
                    {confirm?.title}
                </h1>
                <p className="text-base t-primary">
                    {confirm?.message}
                </p>
                <div className="w-full flex flex-row items-center justify-center space-x-2 mt-4">
                    <ButtonWithLoading
                        loading={loading}
                        onClick={async () => {
                            setLoading(true);
                            await confirm?.onConfirm();
                            setLoading(false);
                            setIsOpen(false);
                        }}
                        title={t('confirm')} />
                    <Button secondary onClick={close} title={t('cancel')} />
                </div>
            </div>
        </Modal>
    )
    return { showConfirm, close, ConfirmUI }
}
