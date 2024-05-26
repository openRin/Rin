import React from "react";

export function Padding({ className = "mx-4", children }: { className?: string, children?: React.ReactNode }) {
    return (<div className={`${className} md:mx-8 lg:mx-12 xl:mx-16 2xl:mx-24 duration-300`} >
        {children}
    </div >)
}