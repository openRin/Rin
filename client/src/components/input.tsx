
export function Input({ autofocus, value, setValue, className, placeholder, onSubmit }:
    { autofocus?: boolean, value: string, className?: string, placeholder: string, id?: number, setValue: (v: string) => void, onSubmit?: () => void }) {
    return (<input
        autoFocus={autofocus}
        placeholder={placeholder}
        value={value}
        onKeyDown={(event) => {
            if (event.key === 'Enter' && onSubmit) {
                onSubmit()
            }
        }}
        onChange={(event) => {
            setValue(event.target.value)
        }}
        className={'focus-visible:outline-none bg-secondary focus-visible:outline-theme w-full py-2 px-4 rounded-xl bg-w t-primary ' + className} />
    )
}
export function Checkbox({ value, setValue, className, placeholder }:
    { value: boolean, className?: string, placeholder: string, id: string, setValue: React.Dispatch<React.SetStateAction<boolean>> }) {
    return (<input type='checkbox'
        placeholder={placeholder}
        checked={value}
        onChange={(event) => {
            setValue(event.target.checked)
        }}
        className={className} />
    )
}