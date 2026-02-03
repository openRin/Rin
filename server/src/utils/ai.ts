import { getAIConfig } from "./db-config";

// AI Provider presets with their default API URLs
const AI_PROVIDER_URLS: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    claude: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    deepseek: "https://api.deepseek.com/v1",
};

/**
 * Generate AI summary for article content
 * Uses OpenAI-compatible API format
 * Configuration is read from D1 database
 */
export async function generateAISummary(db: any, content: string): Promise<string | null> {
    // Get AI configuration from database
    const config = await getAIConfig(db);

    // Check if AI summary is enabled
    if (!config.enabled) {
        return null;
    }

    const { provider, model, api_key, api_url } = config;

    if (!api_key) {
        console.error("[AI Summary] API key not configured");
        return null;
    }

    // Use preset URL if not custom configured
    let finalApiUrl = api_url;
    if (!finalApiUrl && AI_PROVIDER_URLS[provider]) {
        finalApiUrl = AI_PROVIDER_URLS[provider];
    }

    if (!finalApiUrl) {
        console.error("[AI Summary] API URL not configured");
        return null;
    }

    // Truncate content if too long (to save tokens)
    const maxContentLength = 8000;
    const truncatedContent = content.length > maxContentLength
        ? content.slice(0, maxContentLength) + "..."
        : content;

    try {
        const response = await fetch(`${finalApiUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${api_key}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "system",
                        content: "你是一个专业的文章总结助手。请用简洁的中文总结文章的主要内容，不超过200字。只输出总结内容，不要有任何前缀或解释。"
                    },
                    {
                        role: "user",
                        content: truncatedContent
                    }
                ],
                max_tokens: 500,
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Summary] API error: ${response.status} - ${errorText}`);
            return null;
        }

        const data = await response.json() as {
            choices?: Array<{
                message?: {
                    content?: string;
                };
            }>;
        };

        const summary = data.choices?.[0]?.message?.content?.trim();
        if (!summary) {
            console.error("[AI Summary] Empty response from API");
            return null;
        }

        return summary;
    } catch (error) {
        console.error("[AI Summary] Failed to generate summary:", error);
        return null;
    }
}
