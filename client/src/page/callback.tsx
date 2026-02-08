import {useEffect} from "react";
import {useLocation} from "wouter";
import { setAuthToken } from "../utils/auth";

export function CallbackPage() {
    const [, setLocation] = useLocation();
    useEffect(() => {
        // Try to get token from URL query parameter (for cross-domain OAuth)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            setAuthToken(token);
        }
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