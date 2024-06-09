import React from "react";

export function Padding({ className = "mx-8", children }: { className?: string, children?: React.ReactNode }) {
    return (<div className={`${className} sm:mx-8 md:mx-12 lg:mx-16 xl:mx-24 2xl:mx-32 duration-300`} >
        {children}
    </div >)
}