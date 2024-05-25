import React from "react";

export function Padding({ children }: { children?: React.ReactNode }) {
    return (<div className="mx-4 mt-8 md:mx-8 lg:mx-12 xl:mx-16 2xl:mx-24 duration-300">
        {children}
    </div>)
}