function sendWebhook(url: string, data: any) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
}

export function notify(webhook_url: string, message: string) {
    if (!webhook_url) {
        throw new Error('Please set WEBHOOK_URL')
    }
    return sendWebhook(webhook_url, { content: message })
}