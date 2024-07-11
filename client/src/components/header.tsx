import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactModal from "react-modal";
import Popup from "reactjs-popup";
import { removeCookie } from "typescript-cookie";
import { Link, useLocation } from "wouter";
import { useLoginModal } from "../hooks/useLoginModal";
import { Profile, ProfileContext } from "../state/profile";
import { Button } from "./button";
import { IconSmall } from "./icon";
import { Input } from "./input";
import { Padding } from "./padding";


export function Header({ children }: { children?: React.ReactNode }) {
    const profile = useContext(ProfileContext);
    const { t } = useTranslation()

    return useMemo(() => (
        <>
            <div className="fixed z-40">
                <div className="w-screen">
                    <Padding className="mx-4 mt-4">
                        <div className="w-full flex justify-between items-center">
                            <Link aria-label={t('home')} href="/"
                                className="hidden opacity-0 md:opacity-100 duration-300 mr-auto md:flex flex-row items-center">
                                <img src={process.env.AVATAR} alt="Avatar" className="w-12 h-12 rounded-2xl border-2" />
                                <div className="flex flex-col justify-center items-start mx-4">
                                    <p className="text-xl font-bold dark:text-white">
                                        {process.env.NAME}
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        {process.env.DESCRIPTION}
                                    </p>
                                </div>
                            </Link>
                            <div
                                className="w-full md:w-max transition-all duration-500 md:absolute md:left-1/2 md:translate-x-[-50%] flex-row justify-center items-center">
                                <div
                                    className="flex flex-row items-center bg-w t-primary rounded-full px-2 shadow-xl shadow-light">
                                    <Link aria-label={t('home')} href="/"
                                        className="visible opacity-100 md:hidden md:opacity-0 duration-300 mr-auto flex flex-row items-center py-2">
                                        <img src={process.env.AVATAR} alt="Avatar"
                                            className="w-10 h-10 rounded-full border-2" />
                                        <div className="flex flex-col justify-center items-start mx-2">
                                            <p className="text-sm font-bold">
                                                {process.env.NAME}
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {process.env.DESCRIPTION}
                                            </p>
                                        </div>
                                    </Link>
                                    <NavBar menu={false} />
                                    {children}
                                    <Menu />
                                </div>
                            </div>
                            <div className="ml-auto hidden opacity-0 md:opacity-100 duration-300 md:flex flex-row items-center space-x-2">
                                <SearchButton />
                                <LanguageSwitch />
                                <UserAvatar profile={profile} />
                            </div>
                        </div>
                    </Padding>
                </div>
            </div>
            <div className="h-20"></div>
        </>
    ), [profile, children])
}

function NavItem({ menu, title, selected, href, when = true, onClick }: {
    title: string,
    selected: boolean,
    href: string,
    menu?: boolean,
    when?: boolean,
    onClick?: () => void
}) {
    return (
        <>
            {when &&
                <Link href={href}
                    className={`${menu ? "" : "hidden"} md:block cursor-pointer hover:text-theme duration-300 px-2 py-4 md:p-4 text-sm ${selected ? "text-theme" : "dark:text-white"}`}
                    state={{ animate: true }}
                    onClick={onClick}
                >
                    {title}
                </Link>}
        </>
    )
}

function Menu() {
    const profile = useContext(ProfileContext);
    const [isOpen, setOpen] = useState(false)

    function onClose() {
        document.body.style.overflow = "auto"
        setOpen(false)
    }

    return (
        <div className="visible md:hidden flex flex-row items-center">
            <Popup
                arrow={false}
                trigger={<div>
                    <button onClick={() => setOpen(true)}
                        className="w-10 h-10 rounded-full flex flex-row items-center justify-center">
                        <i className="ri-menu-line ri-lg" />
                    </button>
                </div>
                }
                position="bottom right"
                open={isOpen}
                nested
                onOpen={() => document.body.style.overflow = "hidden"}
                onClose={onClose}
                closeOnDocumentClick
                closeOnEscape
                overlayStyle={{ background: "rgba(0,0,0,0.3)" }}
            >
                <div className="flex flex-col bg-w rounded-xl p-2 mt-4 w-[50vw]">
                    <div className="flex flex-row justify-end space-x-2">
                        <SearchButton onClose={onClose} />
                        <LanguageSwitch />
                        <UserAvatar profile={profile} />
                    </div>
                    <NavBar menu={true} onClick={onClose} />
                </div>
            </Popup>
        </div>
    )
}

function NavBar({ menu, onClick }: { menu: boolean, onClick?: () => void }) {
    const profile = useContext(ProfileContext);
    const [location] = useLocation();
    const { t } = useTranslation()
    return (
        <>
            <NavItem menu={menu} onClick={onClick} title={t('article.title')}
                selected={location === "/" || location.startsWith('/feed')} href="/" />
            <NavItem menu={menu} onClick={onClick} title={t('timeline')} selected={location === "/timeline"} href="/timeline" />
            <NavItem menu={menu} onClick={onClick} title={t('hashtags')} selected={location === "/hashtags"} href="/hashtags" />
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title={t('writing')}
                selected={location.startsWith("/writing")} href="/writing" />
            <NavItem menu={menu} onClick={onClick} title={t('friends.title')} selected={location === "/friends"} href="/friends" />
            <NavItem menu={menu} onClick={onClick} title={t('about.title')} selected={location === "/about"} href="/about" />
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title={t('settings.title')}
                selected={location === "/settings"}
                href="/settings" />
        </>
    )
}

function LanguageSwitch({ className }: { className?: string }) {
    const { i18n } = useTranslation()
    const label = 'Languages'
    const languages = [
        { code: 'en', name: 'English' },
        { code: 'zh', name: '简体中文' },
        { code: 'ja', name: '日本語' }
    ]
    return (
        <div className={className + " flex flex-row items-center"}>
            <Popup trigger={
                <button title={label} aria-label={label}
                    className="flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button">
                    <i className="ri-translate-2"></i>
                </button>
            }
                position="bottom right"
                arrow={false}
                closeOnDocumentClick
            >
                <div className="border-card">
                    <p className='font-bold t-primary'>
                        Languages
                    </p>
                    {languages.map(({ code, name }) => (
                        <button key={code} onClick={() => i18n.changeLanguage(code)}>
                            {name}
                        </button>
                    ))}
                </div>
            </Popup>
        </div>
    )
}

function SearchButton({ className, onClose }: { className?: string, onClose?: () => void }) {
    const { t } = useTranslation()
    const [isOpened, setIsOpened] = useState(false);
    const [_, setLocation] = useLocation()
    const [value, setValue] = useState('')
    const label = t('article.search.title')
    const onSearch = () => {
        const key = `${encodeURIComponent(value)}`
        setTimeout(() => {
            setIsOpened(false)
            if (value.length !== 0)
                onClose?.()
        }, 100)
        if (value.length !== 0)
            setLocation(`/search/${key}`)
    }
    return (<div className={className + " flex flex-row items-center"}>
        <button onClick={() => setIsOpened(true)} title={label} aria-label={label}
            className="flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button">
            <i className="ri-search-line"></i>
        </button>
        <ReactModal
            isOpen={isOpened}
            style={{
                content: {
                    top: "20%",
                    left: "50%",
                    right: "auto",
                    bottom: "auto",
                    marginRight: "-50%",
                    transform: "translate(-50%, -50%)",
                    padding: "0",
                    border: "none",
                    borderRadius: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "none",
                },
                overlay: {
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 1000,
                },
            }}
            onRequestClose={() => setIsOpened(false)}
        >
            <div className="bg-w w-full flex flex-row items-center justify-between p-4 space-x-4">
                <Input value={value} setValue={setValue} placeholder={t('article.search.placeholder')}
                    autofocus
                    onSubmit={onSearch} />
                <Button title={value.length === 0 ? t("close") : label} onClick={onSearch} />
            </div>
        </ReactModal>
    </div>
    )
}


function UserAvatar({ className, profile, onClose }: { className?: string, profile?: Profile, onClose?: () => void }) {
    const { t } = useTranslation()
    const { LoginModal, setIsOpened } = useLoginModal(onClose)
    const label = t('github_login')

    return (<div className={className + " flex flex-row items-center"}>
        {profile?.avatar ? <>
            <div className="w-8 relative">
                <img src={profile.avatar} alt="Avatar" className="w-8 h-8 rounded-full border" />
                <div className="z-50 absolute left-0 top-0 w-10 h-8 opacity-0 hover:opacity-100 duration-300">
                    <IconSmall label={t('logout')} name="ri-logout-circle-line" onClick={() => {
                        removeCookie("token")
                        window.location.reload()
                    }} hover={false} />
                </div>
            </div>
        </> : <>
            <button onClick={() => setIsOpened(true)} title={label} aria-label={label}
                className="flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button">
                <i className="ri-user-received-line"></i>
            </button>
        </>}
        <LoginModal />
    </div>
    )
}