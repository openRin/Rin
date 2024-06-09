import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import Popup from "reactjs-popup"
import { Input } from "../components/input"
import { Waiting } from "../components/loading"
import { client } from "../main"
import { ProfileContext } from "../state/profile"
import { shuffleArray } from "../utils/array"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"


type FriendItem = {
    name: string;
    id: number;
    uid: number;
    avatar: string;
    createdAt: Date;
    updatedAt: Date;
    desc: string | null;
    url: string;
    accepted: number;
    health: string;
};
type ApplyItem = {
    name: string;
    id: number;
    uid: number;
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
    desc: string | null;
    url: string;
    accepted: number;
    health: string;
};

async function publish({ name, avatar, desc, url }: { name: string, avatar: string, desc: string, url: string }) {
    const { error } = await client.friend.index.post({
        avatar,
        name,
        desc,
        url
    }, {
        headers: headersWithAuth()
    })
    if (error) {
        alert(error.value)
    } else {
        alert("创建成功")
        window.location.reload()
    }
}

export function FriendsPage() {
    let [friends, setFriends] = useState<FriendItem[]>()
    let [_, setApply] = useState<ApplyItem>()
    const [name, setName] = useState("")
    const [desc, setDesc] = useState("")
    const [avatar, setAvatar] = useState("")
    const [url, setUrl] = useState("")
    const profile = useContext(ProfileContext);

    const ref = useRef(false)
    useEffect(() => {
        if (ref.current) return
        client.friend.index.get().then(({ data }) => {
            if (data) {
                setFriends(data.friend_list)
                if (data.apply_list)
                    setApply(data.apply_list)
            }
        })
        ref.current = true
    }, [])

    function publishButton() {
        publish({ name, desc, avatar, url })
    }
    const friends_avaliable = friends?.filter(({ health }) => health.length === 0) || []
    shuffleArray(friends_avaliable)
    const friends_unavaliable = friends?.filter(({ health }) => health.length > 0) || []
    shuffleArray(friends_unavaliable)
    return (<>
        <Helmet>
            <title>{`${"朋友们"} - ${process.env.NAME}`}</title>
            <meta property="og:site_name" content={siteName} />
            <meta property="og:title" content={"朋友们"} />
            <meta property="og:image" content={process.env.AVATAR} />
            <meta property="og:type" content="article" />
            <meta property="og:url" content={document.URL} />
        </Helmet>
        <Waiting wait={friends}>
            <main className="w-full flex flex-col justify-center items-center mb-8 t-primary">
                {friends_avaliable.length > 0 &&
                    <>
                        <div className="wauto text-start py-4 text-4xl font-bold">
                            <p>
                                朋友们
                            </p>
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                梦想的同行者
                            </p>
                        </div>
                        <div className="wauto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {friends_avaliable.map((friend) => (
                                <Friend key={friend.id} friend={friend} />
                            ))}
                        </div>
                    </>
                }
                {friends_unavaliable.length > 0 &&
                    <>
                        <div className="wauto text-start py-4">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                暂时离开
                            </p>
                        </div>
                        <div className="wauto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {friends_unavaliable.map((friend) => (
                                <Friend key={friend.id} friend={friend} />
                            ))}
                        </div>
                    </>
                }
                {profile && profile.permission &&
                    <div className="wauto t-primary flex text-start text-black text-2xl font-bold mt-8">
                        <div className="md:basis-1/2 bg-w rounded-xl p-4">
                            <p>
                                创建友链
                            </p>
                            <div className="text-sm mt-4 text-neutral-500 font-normal">
                                <Input value={name} setValue={setName} placeholder="站点名称" />
                                <Input value={desc} setValue={setDesc} placeholder="描述" className="mt-2" />
                                <Input value={avatar} setValue={setAvatar} placeholder="头像地址" className="mt-2" />
                                <Input value={url} setValue={setUrl} placeholder="地址" className="my-2" />
                                <div className='flex flex-row justify-center'>
                                    <button onClick={publishButton} className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-light'>创建</button>
                                </div>
                            </div>
                        </div>
                    </div>
                }
            </main>
        </Waiting>
    </>)
}

function Friend({ friend }: { friend: FriendItem }) {
    const profile = useContext(ProfileContext)
    const [avatar, setAvatar] = useState(friend.avatar)
    const [name, setName] = useState(friend.name)
    const [desc, setDesc] = useState(friend.desc || "")
    const [url, setUrl] = useState(friend.url)
    function deleteFriend() {
        if (confirm("确定删除吗？")) {
            client.friend({ id: friend.id }).delete(friend.id, {
                headers: headersWithAuth()
            }).then(({ error }) => {
                if (error) {
                    alert(error.value)
                } else {
                    alert("删除成功")
                    window.location.reload()
                }
            })
        }
    }
    function updateFriend() {
        client.friend({ id: friend.id }).put({
            avatar,
            name,
            desc,
            url
        }, {
            headers: headersWithAuth()
        }).then(({ error }) => {
            if (error) {
                alert(error.value)
            } else {
                alert("更新成功")
                window.location.reload()
            }
        })
    }
    return (
        <>
            <div title={friend.health} onClick={(e) => { console.log(e); window.open(friend.url) }} className="bg-hover w-full bg-w rounded-xl p-4 flex flex-col justify-start items-center relative">
                <div className="w-16 h-16">
                    <img className={"rounded-xl " + (friend.health.length > 0 ? "grayscale" : "")} src={friend.avatar} alt={friend.name} />
                </div>
                <p className="text-base text-center">{friend.name}</p>
                {friend.health.length == 0 && <p className="text-sm text-neutral-500 text-center">{friend.desc}</p>}
                {friend.health.length > 0 && <p className="text-sm text-gray-500 text-center">{errorHumanize(friend.health)}</p>}
                {profile?.permission && <Popup
                    trigger={<button className="absolute top-0 right-0 m-2 px-2 py-1 bg-secondary t-primary rounded-full bg-hover">
                        <i className="ri-settings-line"></i>
                    </button>
                    }
                    modal
                    closeOnDocumentClick
                    closeOnEscape
                    lockScroll
                    overlayStyle={{ background: "rgba(0,0,0,0.3)" }}

                >
                    <div className="w-[80vw] sm:w-[60vw] md:w-[50vw] lg:w-[40vw] xl:w-[30vw] bg-w rounded-xl p-4 flex flex-col justify-start items-center relative">
                        <div className="w-16 h-16">
                            <img className={"rounded-xl " + (friend.health.length > 0 ? "grayscale" : "")} src={friend.avatar} alt={friend.name} />
                        </div>
                        <Input value={name} setValue={setName} placeholder="站点名称" />
                        <Input value={desc} setValue={setDesc} placeholder="描述" className="mt-2" />
                        <Input value={avatar} setValue={setAvatar} placeholder="头像地址" className="mt-2" />
                        <Input value={url} setValue={setUrl} placeholder="地址" className="my-2" />
                        <div className='flex flex-row justify-center space-x-2'>
                            <button onClick={deleteFriend} className="bg-secondary text-theme rounded-full bg-hover px-4 py-2 mt-2">删除</button>
                            <button onClick={updateFriend} className="bg-secondary t-primary rounded-full bg-hover px-4 py-2 mt-2">保存</button>
                        </div>
                    </div >
                </Popup >}
            </div >
        </>
    )
}

function errorHumanize(error: string) {
    if (error === "certificate has expired" || error == "526") {
        return "证书已过期"
    } else if (error.includes("Unable to connect") || error == "521") {
        return "无法访问"
    }
    return error
}