export function HashTag({ name }: { name: string }) {
    return (<div className="flex gap-0.5">
        <div className="text-sm opacity-70 italic dark:text-gray-300">#</div>
        <div className="text-sm opacity-70 dark:text-gray-300">
            {name}
        </div>
    </div>
    )
}