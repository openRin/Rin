/*
 * @Author: Bin
 * @Date: 2024-05-22
 * @FilePath: /oXeu_rin/src/utils/logger.ts
 */
import { Logestic } from 'logestic';
const config = {
    dest: process.env.NODE_ENV === 'test' ? Bun.file('/dev/null') : undefined,
}
const logPlugin = Logestic.preset('fancy', config)
const { logestic: logger } = logPlugin.decorator;

export { logPlugin, logger }