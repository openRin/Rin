export function Input({ value, setValue, className, placeholder }: { value: string, className?: string, placeholder: string, id?: number, setValue: (v: string) => void }) {
    return (<input
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
            setValue(event.target.value)
        }}
        className={'bg-secondary w-full py-2 px-4 rounded-xl bg-w t-primary ' + className} />
    )
}
export function Checkbox({ value, setValue, className, placeholder }: { value: boolean, className?: string, placeholder: string, id: string, setValue: React.Dispatch<React.SetStateAction<boolean>> }) {
    return (<input type='checkbox'
        placeholder={placeholder}
        checked={value}
        onChange={(event) => {
            setValue(event.target.checked)
        }}
        className={className} />
    )
}