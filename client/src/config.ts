// Config constants for Rin client
// This file has no dependencies to avoid circular imports

export const endpoint = process.env.API_URL || ''
export const oauth_url = endpoint + '/api/user/github'
