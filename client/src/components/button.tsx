import ReactLoading from "react-loading";

export function Button({ title, onClick, secondary = false }: { title: string, secondary?: boolean, onClick: () => void }) {
    return (
        <button onClick={onClick} className={`${secondary ? "bg-secondary t-primary bg-button" : "bg-theme text-white active:bg-theme-active hover:bg-theme-hover"} text-nowrap rounded-full px-4 py-2 h-min`}>
            {title}
        </button>
    );
}

export function ButtonWithLoading({ title, onClick, loading, secondary = false }: { title: string, secondary?: boolean, loading: boolean, onClick: () => void }) {
    return (
        <button onClick={onClick} className={`${secondary ? "bg-secondary t-primary bg-button" : "bg-theme text-white active:bg-theme-active hover:bg-theme-hover"} text-nowrap rounded-full px-4 py-2 h-min space-x-2 flex flex-row items-center`}>
            {loading && <ReactLoading width="1em" height="1em" type="spin" color="#FFF" />}
            <span>
                {title}
            </span>
        </button>
    );
}