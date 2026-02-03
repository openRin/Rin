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