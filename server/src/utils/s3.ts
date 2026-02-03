import { AwsClient } from "aws4fetch";

export function createS3Client(env: Env): AwsClient {
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    
    return new AwsClient({
        accessKeyId,
        secretAccessKey,
        service: "s3",
    });
}

export async function putObject(
    client: AwsClient,
    env: Env,
    key: string,
    body: Blob | Buffer | ArrayBuffer | string,
    contentType?: string
) {
    const endpoint = env.S3_ENDPOINT;
    const bucket = env.S3_BUCKET;
    const url = `${endpoint}/${bucket}/${key}`;
    
    const headers: Record<string, string> = {};
    if (contentType) {
        headers["Content-Type"] = contentType;
    }
    
    const response = await client.fetch(url, {
        method: "PUT",
        body,
        headers,
    });
    
    if (!response.ok) {
        throw new Error(`Failed to upload to S3: ${response.status} ${response.statusText}`);
    }
    
    return response;
}
