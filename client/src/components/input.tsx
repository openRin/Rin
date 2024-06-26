import { Cache, Keys } from "../page/writing"

export function Input({ value, setValue, className, placeholder, id, name }: { value: string, className?: string, placeholder: string, id?: number, name?: Keys, setValue: React.Dispatch<React.SetStateAction<string>> }) {
    return (<input
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
            setValue(event.target.value)
            if (name)
                Cache.with(id).set(name, event.target.value)
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