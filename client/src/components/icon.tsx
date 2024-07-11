export function Icon({ name, label, className, onClick, hover = true }: { name: string, label: string, className?: string, onClick: () => any, hover?: boolean }) {
    return (
        <button title={label} aria-label={label} onClick={onClick} className={`max-w-12 flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary ${hover ? "bg-button" : ""} ` + className}>
            <i className={name}></i>
        </button>
    )
}

export function IconSmall({ name, label, className, onClick, hover = true }: { name: string, label: string, className?: string, onClick: () => any, hover?: boolean }) {
    return (
        <button title={label} aria-label={label} onClick={onClick} className={`max-w-8 flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary ${hover ? "bg-button" : ""} ` + className}>
            <i className={name}></i>
        </button>
    )
}
