import { useContext } from "react";
import { useLocation } from "wouter";
import { endpoint } from "../main";
import { ProfileContext } from "../state/profile";
import { Icon } from "./icon";

export function Header() {
    const profile = useContext(ProfileContext);
    const [location, setLocation] = useLocation();
    return (
        <>
            <div className="fixed z-40">
                <div className="w-screen px-32 mt-8">
                    <div className="w-full flex justify-between items-center">
                        <div className="mr-auto flex flex-row items-center">
                            <img src={process.env.AVATAR} alt="Avatar" className="w-12 h-12 rounded-2xl border-2" />
                            <div className="flex flex-col justify-center items-start mx-4">
                                <p className="text-xl font-bold">
                                    {process.env.NAME}
                                </p>
                                <p className="text-sm text-neutral-500">
                                    {process.env.DESCRIPTION}
                                </p>
                            </div>
                        </div>
                        <div className="absolute left-1/2 translate-x-[-50%] flex-row justify-center items-center">
                            <div className="flex flex-row bg-white rounded-full px-2 shadow-xl shadow-neutral-200/30">
                                <NavItem title="文章" selected={location === "/"} onClick={() => { setLocation("/") }} />
                                <NavItem title="标签" selected={false} onClick={() => { }} />
                                {profile?.permission && <NavItem title="写作" selected={location.startsWith("/writing")} onClick={() => { setLocation("/writing") }} />}
                                <NavItem title="朋友们" selected={false} onClick={() => { }} />
                                <NavItem title="关于" selected={location === "/about"} onClick={() => { setLocation("/about") }} />
                            </div>
                        </div>
                        <div className="ml-auto flex flex-row justify-end">
                            {profile?.avatar ? <img src={profile.avatar} alt="Avatar" className="w-10 h-10 rounded-full border-2" /> : <>
                                <Icon name="ri-login-circle-line ri-xl" onClick={() => window.location.href = `${endpoint}/user/github`} />
                            </>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="h-24"></div>
        </>
    )
}

function NavItem({ title, selected, onClick }: { title: string, selected: boolean, onClick: () => void }) {
    return (
        <div onClick={onClick} className={"cursor-pointer hover:text-theme duration-300 p-4 text-base " + (selected ? "text-theme" : "")} >
            {title}
        </div >
    )
}