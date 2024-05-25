import { useContext } from "react";
import { removeCookie } from "typescript-cookie";
import { useLocation } from "wouter";
import { oauth_url } from "../main";
import { Profile, ProfileContext } from "../state/profile";
import { Icon } from "./icon";
import { Padding } from "./padding";

export function Header() {
    const profile = useContext(ProfileContext);
    const [location, setLocation] = useLocation();
    return (
        <>
            <div className="fixed z-40">
                <div className="w-screen">
                    <Padding className="mx-4 mt-4">
                        <div className="w-full flex justify-between items-center">
                            <div className="hidden opacity-0 sm:opacity-100 duration-300 mr-auto sm:flex flex-row items-center">
                                <img src={process.env.AVATAR} alt="Avatar" className="w-12 h-12 rounded-2xl border-2" />
                                <div className="flex flex-col justify-center items-start mx-4">
                                    <p className="text-xl font-bold">
                                        {process.env.NAME}
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        {process.env.DESCRIPTION}
                                    </p>
                                </div>
                            </div>
                            <div className="w-full sm:w-max transition-all duration-500 sm:absolute sm:left-1/2 sm:translate-x-[-50%] flex-row justify-center items-center">
                                <div className="flex flex-row items-center bg-white rounded-full px-2 shadow-xl shadow-neutral-200/30">
                                    <div className="visible opacity-100 sm:hidden sm:opacity-0 duration-300 mr-auto flex flex-row items-center">
                                        <img src={process.env.AVATAR} alt="Avatar" className="w-8 h-8 rounded-full border-2" />
                                        <div className="flex flex-col justify-center items-start mx-2">
                                            <p className="text-sm font-bold">
                                                {process.env.NAME}
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {process.env.DESCRIPTION}
                                            </p>
                                        </div>
                                    </div>
                                    <NavItem title="文章" selected={location === "/" || location.startsWith('/feed')} onClick={() => { setLocation("/") }} />
                                    {/* <NavItem title="标签" selected={false} onClick={() => { }} /> */}
                                    {profile?.permission && <NavItem title="写作" selected={location.startsWith("/writing")} onClick={() => { setLocation("/writing") }} />}
                                    <NavItem title="朋友们" selected={location === "/friends"} onClick={() => { setLocation("/friends") }} />
                                    <NavItem title="关于" selected={location === "/about"} onClick={() => { setLocation("/about") }} />
                                    <UserAvatar className="visible opacity-100 sm:hidden sm:opacity-0 duration-300 justify-center items-center w-8 h-8" profile={profile} />
                                </div>
                            </div>
                            <UserAvatar className="ml-auto hidden opacity-0 sm:block sm:opacity-100 duration-300" profile={profile} />
                        </div>
                    </Padding>
                </div>
            </div>
            <div className="h-24"></div>
        </>
    )
}

function NavItem({ title, selected, onClick }: { title: string, selected: boolean, onClick: () => void }) {
    return (
        <div onClick={onClick} className={"cursor-pointer hover:text-theme duration-300 px-2 py-4 sm:p-4 text-sm " + (selected ? "text-theme" : "")} >
            {title}
        </div >
    )
}

function UserAvatar({ profile, className }: { className?: string, profile?: Profile }) {
    return (<div className={"flex flex-row justify-end " + className}>
        {profile?.avatar ? <>
            <div className="relative">
                <img src={profile.avatar} alt="Avatar" className="w-10 h-10 rounded-full border-2" />
                <div className="z-50 absolute left-0 top-0 w-10 h-10 opacity-0 hover:opacity-100 duration-300">
                    <Icon name="ri-login-circle-line ri-xl" onClick={() => {
                        removeCookie("token")
                        window.location.reload()
                    }} hover={false} />
                </div>
            </div>
        </> : <>
            <Icon name="ri-login-circle-line ri-md" onClick={() => window.location.href = `${oauth_url}`} />
        </>}
    </div>)
}