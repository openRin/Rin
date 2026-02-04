import { describe, it, expect } from 'bun:test';

// 复制 deploy-cf.ts 中的解析函数（更新版，使用 --json 输出）
// 注意：--json 输出格式是数组包裹的：[{ results: [...], success: true, meta: {} }]
function parseWranglerCount(stdout: string): number {
    try {
        const json = JSON.parse(stdout);
        // --json output format: [{ results: [{ count: N }], success: true, meta: {} }]
        if (Array.isArray(json) && json.length > 0 && json[0].results && json[0].results.length > 0) {
            return parseInt(json[0].results[0].count) || 0;
        }
    } catch (e) {
        // Fallback
        const match = stdout.match(/"count":\s*(\d+)/);
        if (match) {
            return parseInt(match[1]) || 0;
        }
    }
    return 0;
}

function parseWranglerFeedIds(stdout: string): number[] {
    try {
        const json = JSON.parse(stdout);
        // --json output format: [{ results: [{ feed_id: N }, ...], success: true, meta: {} }]
        if (Array.isArray(json) && json.length > 0 && json[0].results) {
            return json[0].results
                .map((row: any) => parseInt(row.feed_id))
                .filter((id: number) => !isNaN(id));
        }
    } catch (e) {
        // Fallback
        return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => /^\d+$/.test(line))
            .map(id => parseInt(id));
    }
    return [];
}

function parseWranglerIPs(stdout: string): string[] {
    try {
        const json = JSON.parse(stdout);
        // --json output format: [{ results: [{ ip: 'x.x.x.x' }, ...], success: true, meta: {} }]
        if (Array.isArray(json) && json.length > 0 && json[0].results) {
            return json[0].results
                .map((row: any) => row.ip)
                .filter((ip: string) => ip && typeof ip === 'string');
        }
    } catch (e) {
        // Fallback
        return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !/^\d+$/.test(line) && line !== 'ip');
    }
    return [];
}

describe('Wrangler --json 输出解析测试', () => {
    it('应该正确解析 --json 格式的 count 查询', () => {
        // 使用 --json 参数后的 JSON 输出（数组包裹格式）
        const wranglerOutput = JSON.stringify([{
            results: [{ count: 0 }],
            success: true,
            meta: {
                served_by: "v3-prod",
                duration: 0.2563
            }
        }]);

        console.log('\n测试 --json count 解析:');
        console.log('  输入:', wranglerOutput);
        
        const count = parseWranglerCount(wranglerOutput);
        console.log('  解析结果:', count);
        
        expect(count).toBe(0);
    });

    it('应该正确解析 --json 格式的非零 count', () => {
        const wranglerOutput = JSON.stringify([{
            results: [{ count: 27489 }],
            success: true,
            meta: {}
        }]);

        const count = parseWranglerCount(wranglerOutput);
        console.log('\n测试 --json 非零 count:', count);
        
        expect(count).toBe(27489);
    });

    it('应该正确解析 --json 格式的 feed_id 列表', () => {
        const wranglerOutput = JSON.stringify([{
            results: [
                { feed_id: 1 },
                { feed_id: 2 },
                { feed_id: 3 },
                { feed_id: 42 }
            ],
            success: true,
            meta: {}
        }]);

        console.log('\n测试 --json feed_id 解析:');
        console.log('  输入:', wranglerOutput);
        
        const feedIds = parseWranglerFeedIds(wranglerOutput);
        console.log('  解析结果:', feedIds);
        
        expect(feedIds).toEqual([1, 2, 3, 42]);
        expect(feedIds.length).toBe(4);
    });

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
        
        const ips = parseWranglerIPs(wranglerOutput);
        console.log('  解析结果:', ips);
        
        expect(ips).toEqual(['192.168.1.1', '192.168.1.2', '10.0.0.1', '172.16.0.1']);
        expect(ips.length).toBe(4);
    });

    it('应该处理空的 results', () => {
        const wranglerOutput = JSON.stringify([{
            results: [],
            success: true,
            meta: {}
        }]);

        const count = parseWranglerCount(wranglerOutput);
        const feedIds = parseWranglerFeedIds(wranglerOutput);
        const ips = parseWranglerIPs(wranglerOutput);

        console.log('\n测试空 results:');
        console.log('  count:', count);
        console.log('  feedIds:', feedIds);
        console.log('  ips:', ips);

        expect(count).toBe(0);
        expect(feedIds).toEqual([]);
        expect(ips).toEqual([]);
    });
});
