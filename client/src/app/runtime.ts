import { createClient } from "../api/client";
import { endpoint, oauth_url } from "../config";

export { endpoint, oauth_url };

export const client = createClient(endpoint);
