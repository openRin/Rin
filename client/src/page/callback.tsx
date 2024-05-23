import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";

export function CallbackPage() {
    const searchParams = new URLSearchParams(useSearch());
    const [_, setLocation] = useLocation();
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            document.cookie = `token=${token}; path=/; max-age=604800;`;
            setLocation("/");
        }
    }, [searchParams]);
    return (<>
        <div className="w-screen h-screen flex justify-center items-center">
            <div className="text-center text-black p-4 text-xl font-bold">
                <p>
                    Waiting...
                </p>
            </div>
        </div>
    </>)
}