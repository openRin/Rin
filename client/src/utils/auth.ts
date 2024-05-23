import { getCookie } from "typescript-cookie";

export function headersWithAuth() {
    return {
        'Authorization': `Bearer ${getCookie('token')}`
    }
}