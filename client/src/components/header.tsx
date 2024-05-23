import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { client, endpoint } from "../main";
import { headersWithAuth } from "../utils/auth";

export function Header() {
    const [location, setLocation] = useLocation();
    const [avatar, setAvatar] = useState<string>('')
    const [permission, setPermission] = useState<boolean>(false)
    useEffect(() => {
        client.user.profile.get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data != 'string') {
                if (data.avatar)
                    setAvatar(data.avatar)
                setPermission(data.permission)
            }
        })
    }, [])
    return (
        <>
            <div className="fixed">
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
                            <div className="flex flex-row bg-white rounded-full px-2 shadow-xl shadow-neutral-200">
                                <NavItem title="文章" selected={location === "/"} onClick={() => { setLocation("/") }} />
                                <NavItem title="标签" selected={false} onClick={() => { }} />
                                {permission && <NavItem title="写作" selected={location === "/writing"} onClick={() => { setLocation("/writing") }} />}
                                <NavItem title="朋友们" selected={false} onClick={() => { }} />
                                <NavItem title="关于" selected={location === "/about"} onClick={() => { setLocation("/about") }} />
                            </div>
                        </div>
                        <div className="ml-auto flex flex-row justify-end">
                            {avatar ? <img src={avatar} alt="Avatar" className="w-10 h-10 rounded-full border-2" /> : <>
                                <div onClick={() => window.location.href = `${endpoint}/user/github`} className="hover:bg-neutral-200 flex rounded-full border px-3 bg-white aspect-[1] items-center justify-center">
                                    <i className="ri-login-circle-line ri-xl"></i>
                                </div>
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