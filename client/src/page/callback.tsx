import {useEffect} from "react";
import {useLocation} from "wouter";

export function CallbackPage() {
    const [, setLocation] = useLocation();
    useEffect(() => {
        setLocation("/");
    }, []);
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