import ReactLoading from "react-loading";

export function Waiting({ for: wait, children }: { for?: any, children?: React.ReactNode }) {
    return (
        <>
            {!wait ?
                <div className="w-full h-96 flex flex-col justify-center items-center mb-8 ani-show-fast">
                    <ReactLoading type="cylon" color="#FC466B" />
                </div>
                : children}
        </>
    )
}