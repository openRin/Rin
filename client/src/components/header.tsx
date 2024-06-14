import {useContext, useState} from "react";
import Popup from "reactjs-popup";
import {removeCookie} from "typescript-cookie";
import {Link, useLocation} from "wouter";
import {oauth_url} from "../main";
import {Profile, ProfileContext} from "../state/profile";
import {Icon} from "./icon";
import {Padding} from "./padding";


export function Header({children}: { children?: React.ReactNode }) {
    const profile = useContext(ProfileContext);

    return (
        <>
            <div className="fixed z-40">
                <div className="w-screen">
                    <Padding className="mx-4 mt-4">
                        <div className="w-full flex justify-between items-center">
                            <Link aria-label="首页" href="/"
                                  className="hidden opacity-0 md:opacity-100 duration-300 mr-auto md:flex flex-row items-center">
                                <img src={process.env.AVATAR} alt="Avatar" className="w-12 h-12 rounded-2xl border-2"/>
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
                                    <Link aria-label="首页" href="/"
                                          className="visible opacity-100 md:hidden md:opacity-0 duration-300 mr-auto flex flex-row items-center py-2">
                                        <img src={process.env.AVATAR} alt="Avatar"
                                             className="w-10 h-10 rounded-full border-2"/>
                                        <div className="flex flex-col justify-center items-start mx-2">
                                            <p className="text-sm font-bold">
                                                {process.env.NAME}
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {process.env.DESCRIPTION}
                                            </p>
                                        </div>
                                    </Link>
                                    <NavBar menu={false}/>
                                    {children}
                                    <Menu/>
                                </div>
                            </div>
                            <UserAvatar className="ml-auto hidden opacity-0 md:block md:opacity-100 duration-300"
                                        profile={profile}/>
                        </div>
                    </Padding>
                </div>
            </div>
            <div className="h-20"></div>
        </>
    )
}

function NavItem({menu, title, selected, href, when = true, onClick}: {
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
                      state={{animate: true}}
                      onClick={onClick}
                >
                    {title}
                </Link>}
        </>
    )
}

function UserAvatar({profile, className, mobile}: { className?: string, profile?: Profile, mobile?: boolean }) {
    return (<div className={"flex flex-row justify-end " + className}>
        {profile?.avatar ? <>
            <div className="relative">
                <img src={profile.avatar} alt="Avatar" className="w-10 h-10 rounded-full border-2"/>
                <div className="z-50 absolute left-0 top-0 w-10 h-10 opacity-0 hover:opacity-100 duration-300">
                    <Icon label="退出登录" name="ri-logout-circle-line ri-xl" onClick={() => {
                        removeCookie("token")
                        window.location.reload()
                    }} hover={false}/>
                </div>
            </div>
        </> : <>
            <button title="Github 登录" aria-label="Github 登录"
                    onClick={() => window.location.href = `${oauth_url}`}
                    className={`flex rounded-xl ${mobile ? "bg-secondary" : "bg-w"} h-10 sm:h-auto px-2 py-2 bg-w bg-hover t-secondary items-center justify-center`}>
                <i className="ri-github-line ri-xl"></i>
                <p className="text-sm ml-1">
                    Github 登录
                </p>
            </button>
        </>}
    </div>)
}

function Menu() {
    const profile = useContext(ProfileContext);
    const [isOpen, setOpen] = useState(false)

    function onClose() {
        console.log("close")
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
                        <i className="ri-menu-line ri-lg"/>
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
                overlayStyle={{background: "rgba(0,0,0,0.3)"}}
            >
                <div className="flex flex-col bg-w rounded-xl p-2 mt-4 w-[50vw]">
                    <UserAvatar profile={profile} mobile/>
                    <NavBar menu={true} onClick={onClose}/>
                </div>
            </Popup>
        </div>
    )
}

function NavBar({menu, onClick}: { menu: boolean, onClick?: () => void }) {
    const profile = useContext(ProfileContext);
    const [location] = useLocation();
    return (
        <>
            <NavItem menu={menu} onClick={onClick} title="文章"
                     selected={location === "/" || location.startsWith('/feed')} href="/"/>
            <NavItem menu={menu} onClick={onClick} title="时间轴" selected={location === "/timeline"} href="/timeline"/>
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title="写作"
                     selected={location.startsWith("/writing")} href="/writing"/>
            <NavItem menu={menu} onClick={onClick} title="朋友们" selected={location === "/friends"} href="/friends"/>
            <NavItem menu={menu} onClick={onClick} title="关于" selected={location === "/about"} href="/about"/>
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title="设置"
                     selected={location === "/settings"}
                     href="/settings"/>
        </>
    )
}