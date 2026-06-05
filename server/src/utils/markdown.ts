export function stripMarkdown(content: string): string {
    let text = content;

    text = text.replace(/<!--[\s\S]*?-->/g, "");
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
    text = text.replace(/<pre[\s\S]*?<\/pre>/gi, "");

    text = text.replace(/!\[.*?\]\(.*?\)/g, "");
    text = text.replace(/\[([^\]]*)\]\(.*?\)/g, "$1");
    text = text.replace(/^#{1,6}\s+/gm, "");
    text = text.replace(/^>\s+/gm, "");
    text = text.replace(/^[-*+]\s+/gm, "");
    text = text.replace(/^\d+\.\s+/gm, "");
    text = text.replace(/^(\s*)- \[[ x]\]\s+/gm, "$1");
    text = text.replace(/`{3}[\s\S]*?`{3}/g, "");
    text = text.replace(/`([^`]+)`/g, "$1");
    text = text.replace(/\*\*(.+?)\*\*/g, "$1");
    text = text.replace(/__(.+?)__/g, "$1");
    text = text.replace(/\*(.+?)\*/g, "$1");
    text = text.replace(/_(.+?)_/g, "$1");
    text = text.replace(/~~(.+?)~~/g, "$1");
    text = text.replace(/<[^>]+>/g, "");
    text = text.replace(/\[.*?\]\[.*?\]/g, "");
    text = text.replace(/^\[.*?\]:\s+.*$/gm, "");
    text = text.replace(/^---+$/gm, "");
    text = text.replace(/\|\s*[-:]+\s*\|/g, "");
    text = text.replace(/\|/g, " ");
    text = text.replace(/---+$/gm, "");
    text = text.replace(/\$\$[\s\S]*?\$\$/g, "");
    text = text.replace(/\$([^$]+)\$/g, "$1");
    text = text.replace(/:\w+:/g, "");
    text = text.replace(/^> \[!\w+\]/gm, "");

    text = text.replace(/\n{2,}/g, "\n");
    text = text.trim();

    return text;
}
