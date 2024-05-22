/*
 * @Author: Bin
 * @Date: 2024-05-22
 * @FilePath: /oXeu_rin/src/utils/logger.ts
 */
import { Logestic } from 'logestic';

const logPlugin = Logestic.preset('fancy')
const {logestic: logger} = logPlugin.decorator;

export {logPlugin, logger}