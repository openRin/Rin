import { useLocation } from "wouter"

export function HashTag({ name }: { name: string }) {
    const [, setLocation] = useLocation()
    return (
        <button onClick={(e) => { e.preventDefault(); setLocation(`/hashtag/${name}`) }}
            className="max-w-full min-w-0 text-base t-secondary hover:text-theme text-pretty" >
            <div className="flex min-w-0 gap-0.5">
                <div className="shrink-0 text-sm italic opacity-70">#</div>
                <div className="min-w-0 truncate text-sm opacity-70">
                    {name}
                </div>
            </div>
        </button >
    )
}
