export function Icon({ name, className, onClick, hover = true }: { name: string, className?: string, onClick: () => any, hover?: boolean }) {
    return (
        <div onClick={onClick} className={`max-w-12 flex rounded-full border px-3 bg-white aspect-[1] items-center justify-center ${hover ? "hover:bg-neutral-200" : ""} ` + className}>
            <i className={name}></i>
        </div>
    )
}