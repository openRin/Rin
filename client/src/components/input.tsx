export function Input({ value, setValue, className, placeholder, id }: { value: string, className?: string, placeholder: string, id?: string, setValue: React.Dispatch<React.SetStateAction<string>> }) {
    return (<input type='text'
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
            setValue(event.target.value)
            if (id)
                localStorage.setItem(id, value)
        }}
        className={'w-full py-2 px-4 rounded-xl ' + className} />
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