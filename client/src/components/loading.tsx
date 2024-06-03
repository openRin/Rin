import ReactLoading from "react-loading";

export function Waiting({ wait, children }: { wait?: any, children?: React.ReactNode }) {
    return (
        <>
            {!wait ?
                <div className="w-full h-96 flex flex-col justify-center items-center mb-8">
                    <ReactLoading type="cylon" color="#FC466B" />
                </div>
                : children}
        </>
    )
}