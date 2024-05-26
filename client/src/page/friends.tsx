import { useState, useRef, useEffect, useContext } from "react"
import { Header } from "../components/header"
import { Padding } from "../components/padding"
import { client } from "../main"
import { Input } from "../components/input"
import { headersWithAuth } from "../utils/auth"
import { ProfileContext } from "../state/profile"

export function FriendsPage() {
    return (<>
        <Header />
        <Padding>
            <Friends />
        </Padding>
    </>)
}

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

function Friends() {
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
    const friends_avaliable = friends?.filter(({ health }) => health.length === 0)
    const friends_unavaliable = friends?.filter(({ health }) => health.length > 0)
    return (<>
        <div className="w-full flex flex-col justify-center items-center">
            {friends_avaliable && (friends_avaliable.length > 0) &&
                <>
                    <div className="wauto text-start text-black py-4 text-4xl font-bold">
                        <p>
                            朋友们
                        </p>
                        <p className="text-sm mt-4 text-neutral-500 font-normal">
                            梦想的同行者
                        </p>
                    </div>
                    <div className="wauto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {friends_avaliable.map((friend) => (
                            <>
                                <Friend friend={friend} />
                            </>
                        ))}
                    </div>
                </>
            }
            {friends_unavaliable && (friends_unavaliable.length > 0) &&
                <>
                    <div className="wauto text-start text-black py-4">
                        <p className="text-sm mt-4 text-neutral-500 font-normal">
                            暂时离开
                        </p>
                    </div>
                    <div className="wauto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {friends_unavaliable.map((friend) => (
                            <>
                                <Friend friend={friend} />
                            </>
                        ))}
                    </div>
                </>
            }
            {profile && profile.permission &&
                <div className="wauto flex text-start text-black text-2xl font-bold my-8">
                    <div className="md:basis-1/2 bg-white rounded-xl p-4">
                        <p>
                            创建友链
                        </p>
                        <div className="text-sm mt-4 text-neutral-500 font-normal">
                            <Input value={name} setValue={setName} placeholder="站点名称" />
                            <Input value={desc} setValue={setDesc} placeholder="描述" className="mt-2" />
                            <Input value={avatar} setValue={setAvatar} placeholder="头像地址" className="mt-2" />
                            <Input value={url} setValue={setUrl} placeholder="地址" className="my-2" />
                            <div className='flex flex-row justify-center'>
                                <button onClick={publishButton} className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-neutral-200'>创建</button>
                            </div>
                        </div>
                    </div>
                </div>
            }
        </div>
    </>)
}

function Friend({ friend }: { friend: FriendItem }) {
    return (
        <>
            <div title={errorHumanize(friend.health)} onClick={() => window.open(friend.url)} className="hover:bg-neutral-200 w-full bg-white rounded-xl p-4 flex flex-col justify-start items-center">
                <div className="w-16 h-16">
                    <img className={"rounded-xl " + (friend.health.length > 0 ? "grayscale" : "")} src={friend.avatar} alt={friend.name} />
                </div>
                <p className="text-base text-center">{friend.name}</p>
                {friend.health.length == 0 && <p className="text-sm text-neutral-500 text-center">{friend.desc}</p>}
                {friend.health.length > 0 && <p className="text-sm text-gray-500 text-center">{errorHumanize(friend.health)}</p>}
            </div>
        </>
    )
}

function errorHumanize(error: string) {
    if (error === "certificate has expired") {
        return "证书已过期"
    } else if (error.includes("Unable to connect")) {
        return "无法访问"
    }
    return error
}