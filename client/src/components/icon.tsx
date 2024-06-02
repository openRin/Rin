export function Icon({ name, label, className, onClick, hover = true }: { name: string, label: string, className?: string, onClick: () => any, hover?: boolean }) {
    return (
        <button aria-label={label} onClick={onClick} className={`max-w-12 flex rounded-full border px-2 bg-white aspect-[1] items-center justify-center ${hover ? "hover:bg-neutral-200" : ""} ` + className}>
            <i className={name}></i>
        </button>
    )
}

export function IconSmall({ name, label, className, onClick, hover = true }: { name: string, label: string, className?: string, onClick: () => any, hover?: boolean }) {
    return (
        <button aria-label={label} onClick={onClick} className={`max-w-8 flex rounded-full border px-2 bg-white aspect-[1] items-center justify-center ${hover ? "hover:bg-neutral-200" : ""} ` + className}>
            <i className={name}></i>
        </button>
    )
}