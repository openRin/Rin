export function Header() {
    return (
        <>
            <div className="fixed">
                <div className="relative w-screen ">
                    <div className="flex flex-row items-center mx-32 mt-8">
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
                    <div className="absolute left-0 right-0 top-0 bottom-0 flex flex-row justify-center items-center">
                        <div className="flex flex-row bg-white rounded-full px-2 shadow-xl shadow-neutral-200">
                            <NavItem title="文章" selected={true} onClick={() => { }} />
                            <NavItem title="标签" selected={false} onClick={() => { }} />
                            <NavItem title="朋友们" selected={false} onClick={() => { }} />
                            <NavItem title="关于" selected={false} onClick={() => { }} />
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
        <div onClick={onClick} className={"cursor-pointer hover:text-theme duration-300 p-4 text-lg " + (selected ? "text-theme" : "")} >
            {title}
        </div >
    )
}