import { describe, it, expect } from 'bun:test';
import { WranglerParsers } from './test-utils';

describe('Wrangler --json 输出解析测试', () => {
    describe('parseCount', () => {
        it('应该正确解析 --json 格式的 count 查询', () => {
            const wranglerOutput = JSON.stringify([{
                results: [{ count: 0 }],
                success: true,
                meta: { served_by: "v3-prod", duration: 0.2563 }
            }]);

            console.log('\n测试 --json count 解析:');
            console.log('  输入:', wranglerOutput);
            
            const count = WranglerParsers.parseCount(wranglerOutput);
            console.log('  解析结果:', count);
            
            expect(count).toBe(0);
        });

        it('应该正确解析 --json 格式的非零 count', () => {
            const wranglerOutput = JSON.stringify([{
                results: [{ count: 27489 }],
                success: true,
                meta: {}
            }]);

            const count = WranglerParsers.parseCount(wranglerOutput);
            console.log('\n测试 --json 非零 count:', count);
            
            expect(count).toBe(27489);
        });

        it('应该处理空的 results', () => {
            const wranglerOutput = JSON.stringify([{ results: [], success: true, meta: {} }]);
            const count = WranglerParsers.parseCount(wranglerOutput);
            expect(count).toBe(0);
        });
    });

    describe('parseFeedIds', () => {
        it('应该正确解析 --json 格式的 feed_id 列表', () => {
            const wranglerOutput = JSON.stringify([{
                results: [{ feed_id: 1 }, { feed_id: 2 }, { feed_id: 3 }, { feed_id: 42 }],
                success: true,
                meta: {}
            }]);

            console.log('\n测试 --json feed_id 解析:');
            console.log('  输入:', wranglerOutput);
            
            const feedIds = WranglerParsers.parseFeedIds(wranglerOutput);
            console.log('  解析结果:', feedIds);
            
            expect(feedIds).toEqual([1, 2, 3, 42]);
            expect(feedIds.length).toBe(4);
        });

        it('应该处理空的 results', () => {
            const wranglerOutput = JSON.stringify([{ results: [], success: true, meta: {} }]);
            const feedIds = WranglerParsers.parseFeedIds(wranglerOutput);
            expect(feedIds).toEqual([]);
        });
    });

    describe('parseIPs', () => {
        it('应该正确解析 --json 格式的 IP 列表', () => {
            const wranglerOutput = JSON.stringify([{
                results: [
                    { ip: '192.168.1.1' },
                    { ip: '192.168.1.2' },
                    { ip: '10.0.0.1' },
                    { ip: '172.16.0.1' }
                ],
                success: true,
                meta: {}
            }]);

            console.log('\n测试 --json IP 解析:');
            console.log('  输入:', wranglerOutput);
            
            const ips = WranglerParsers.parseIPs(wranglerOutput);
            console.log('  解析结果:', ips);
            
            expect(ips).toEqual(['192.168.1.1', '192.168.1.2', '10.0.0.1', '172.16.0.1']);
            expect(ips.length).toBe(4);
        });

        it('应该处理空的 results', () => {
            const wranglerOutput = JSON.stringify([{ results: [], success: true, meta: {} }]);
            const ips = WranglerParsers.parseIPs(wranglerOutput);
            expect(ips).toEqual([]);
        });
    });

    describe('边界情况', () => {
        it('应该处理所有解析器的空 results', () => {
            const wranglerOutput = JSON.stringify([{ results: [], success: true, meta: {} }]);

            const count = WranglerParsers.parseCount(wranglerOutput);
            const feedIds = WranglerParsers.parseFeedIds(wranglerOutput);
            const ips = WranglerParsers.parseIPs(wranglerOutput);

            console.log('\n测试空 results:');
            console.log('  count:', count);
            console.log('  feedIds:', feedIds);
            console.log('  ips:', ips);

            expect(count).toBe(0);
            expect(feedIds).toEqual([]);
            expect(ips).toEqual([]);
        });
    });
});
