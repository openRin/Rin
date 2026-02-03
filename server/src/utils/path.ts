export function path_join(...paths: string[]): string {
    const separator = '/';
    const resolvedParts: string[] = [];
    let isAbsolute = false;

    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];

        if (path.length === 0) continue;

        if (i === 0 && path.startsWith(separator)) {
            isAbsolute = true;
        }

        const parts = path.split(separator).filter(part => part.length > 0);

        for (const part of parts) {
            if (part === '..') {
                if (resolvedParts.length > 0 && resolvedParts[resolvedParts.length - 1] !== '..') {
                    resolvedParts.pop();
                } else if (!isAbsolute) {
                    resolvedParts.push(part);
                }
            }
            else if (part === '.') {
                continue;
            }
            else if (part.length === 0) {
                continue;
            }
            else {
                resolvedParts.push(part);
            }
        }
    }

    let result = resolvedParts.join(separator);

    if (result.length === 0) {
        return isAbsolute ? separator : '.';
    }

    if (isAbsolute) {
        return separator + result;
    }

    return result;
}

/**
 * 提取URL中第一段路径（path segment）
 * 纯TypeScript实现，不依赖Node.js和浏览器环境
 * 
 * @param url 要解析的URL字符串
 * @returns 第一段路径，如果没有路径则返回空字符串
 * 
 * @example
 * getFirstPathSegment('https://example.com/api/users/123') // 'api'
 * getFirstPathSegment('https://example.com/') // ''
 * getFirstPathSegment('/api/users/123') // 'api'
 * getFirstPathSegment('relative/path/to/resource') // 'relative'
 */
export function getFirstPathSegment(url: string): string {
    // 1. 移除协议部分（如果存在）
    let pathPart = url;

    // 处理协议（http://, https://, ftp:// 等）
    const protocolIndex = url.indexOf('://');
    if (protocolIndex !== -1) {
        // 跳过协议部分，找到第一个斜杠或路径开始
        const afterProtocol = url.substring(protocolIndex + 3);
        const firstSlashIndex = afterProtocol.indexOf('/');

        if (firstSlashIndex !== -1) {
            // 有路径部分
            pathPart = afterProtocol.substring(firstSlashIndex);
        } else {
            // 没有路径部分，只有域名
            return '';
        }
    }

    // 2. 如果以斜杠开头，去掉开头的斜杠
    let path = pathPart.startsWith('/') ? pathPart.substring(1) : pathPart;

    // 3. 处理查询字符串和hash
    const queryIndex = path.indexOf('?');
    const hashIndex = path.indexOf('#');

    // 找到第一个查询字符串或hash的位置
    let endIndex = path.length;
    if (queryIndex !== -1) {
        endIndex = Math.min(endIndex, queryIndex);
    }
    if (hashIndex !== -1) {
        endIndex = Math.min(endIndex, hashIndex);
    }

    if (endIndex < path.length) {
        path = path.substring(0, endIndex);
    }

    // 4. 分割路径并获取第一段
    const segments = path.split('/').filter(segment => segment.length > 0);

    if (segments.length === 0) {
        return '';
    }

    // 返回第一段，但先进行解码（处理URL编码）
    try {
        return decodeURIComponent(segments[0]);
    } catch {
        // 如果解码失败（如非法的URI编码），返回原始字符串
        return segments[0];
    }
}