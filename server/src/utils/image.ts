export function stripImageMetadataFromUrl(url?: string | null) {
    if (!url) {
        return undefined;
    }

    return url.split("#", 2)[0];
}

export function extractImage(content: string) {
    const img_reg = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/;
    const img_match = img_reg.exec(content);
    let avatar: string | undefined = undefined;
    if (img_match) {
        avatar = stripImageMetadataFromUrl(img_match[1]);
    }
    return avatar;
}
