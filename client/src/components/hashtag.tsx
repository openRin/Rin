import { useLocation } from "wouter"

export function HashTag({ name }: { name: string }) {
    const [_, setLocation] = useLocation()
    const baseClass = "glass-tag hover:scale-105 active:scale-95 transition-transform cursor-pointer"

    return (
        <button onClick={(e) => { e.preventDefault(); setLocation(`/hashtag/${name}`) }}
            className={baseClass} >
            <div className="flex gap-0.5 items-center">
                <div className="text-sm opacity-60">#</div>
                <div className="text-sm">
                    {name}
                </div>
            </div>
        </button >
    )
}
