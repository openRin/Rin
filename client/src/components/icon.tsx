export function Icon({ name, className, onClick }: { name: string, className?: string, onClick: () => any }) {
    return (
        <div onClick={onClick} className={"max-w-12 hover:bg-neutral-200 flex rounded-full border px-3 bg-white aspect-[1] items-center justify-center " + className}>
            <i className={name}></i>
        </div>
    )
}