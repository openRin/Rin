import { describe, it, expect } from 'bun:test';

// 复制 deploy-cf.ts 中的解析函数
function parseWranglerCount(stdout: string): number {
    try {
        const json = JSON.parse(stdout);
        if (Array.isArray(json) && json.length > 0 && json[0].results && json[0].results.length > 0) {
            return parseInt(json[0].results[0].count) || 0;
        }
    } catch (e) {
        // Fallback to regex if JSON parsing fails
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
        if (Array.isArray(json) && json.length > 0 && json[0].results) {
            return json[0].results
                .map((row: any) => parseInt(row.feed_id))
                .filter((id: number) => !isNaN(id));
        }
    } catch (e) {
        // Fallback to line parsing if JSON parsing fails
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
        if (Array.isArray(json) && json.length > 0 && json[0].results) {
            return json[0].results
                .map((row: any) => row.ip)
                .filter((ip: string) => ip && typeof ip === 'string');
        }
    } catch (e) {
        // Fallback to line parsing if JSON parsing fails
        return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !/^\d+$/.test(line) && line !== 'ip')
            .filter(line => /^(\d{1,3}\.){3}\d{1,3}$/.test(line) || line.includes(':'));
    }
    return [];
}

describe('Wrangler JSON 解析测试', () => {
    it('应该正确解析 count 查询结果', () => {
        const wranglerOutput = JSON.stringify([
            {
                results: [{ count: 0 }],
                success: true,
                meta: {
                    served_by: "v3-prod",
                    served_by_region: "APAC",
                    served_by_colo: "NRT",
                    duration: 0.2563,
                    changes: 0,
                    last_row_id: 0,
                    changed_db: false,
                    size_after: 1150976,
                    rows_read: 23,
                    rows_written: 0
                }
            }
        ], null, 2);

        console.log('\n测试 count 解析:');
        console.log('  输入:', wranglerOutput.substring(0, 200) + '...');
        
        const count = parseWranglerCount(wranglerOutput);
        console.log('  解析结果:', count);
        
        expect(count).toBe(0);
    });

    it('应该正确解析非零 count', () => {
        const wranglerOutput = JSON.stringify([
            {
                results: [{ count: 42 }],
                success: true,
                meta: { duration: 1.5 }
            }
        ]);

        const count = parseWranglerCount(wranglerOutput);
        console.log('\n测试非零 count 解析:', count);
        
        expect(count).toBe(42);
    });

    it('应该正确解析 feed_id 列表', () => {
        const wranglerOutput = JSON.stringify([
            {
                results: [
                    { feed_id: 1 },
                    { feed_id: 2 },
                    { feed_id: 3 }
                ],
                success: true,
                meta: {}
            }
        ]);

        console.log('\n测试 feed_id 解析:');
        console.log('  输入:', wranglerOutput);
        
        const feedIds = parseWranglerFeedIds(wranglerOutput);
        console.log('  解析结果:', feedIds);
        
        expect(feedIds).toEqual([1, 2, 3]);
    });

    it('应该正确解析 IP 列表', () => {
        const wranglerOutput = JSON.stringify([
            {
                results: [
                    { ip: '192.168.1.1' },
                    { ip: '192.168.1.2' },
                    { ip: '10.0.0.1' }
                ],
                success: true,
                meta: {}
            }
        ]);

        console.log('\n测试 IP 解析:');
        console.log('  输入:', wranglerOutput);
        
        const ips = parseWranglerIPs(wranglerOutput);
        console.log('  解析结果:', ips);
        
        expect(ips).toEqual(['192.168.1.1', '192.168.1.2', '10.0.0.1']);
    });

    it('应该处理旧格式的文本输出（fallback）', () => {
        const oldFormatOutput = `
feed_id
1
2
3
        `.trim();

        console.log('\n测试旧格式 feed_id 解析:');
        console.log('  输入:', oldFormatOutput);
        
        const feedIds = parseWranglerFeedIds(oldFormatOutput);
        console.log('  解析结果:', feedIds);
        
        expect(feedIds).toEqual([1, 2, 3]);
    });

    it('应该处理旧格式的 IP 输出（fallback）', () => {
        const oldFormatOutput = `
ip
192.168.1.1
192.168.1.2
10.0.0.1
        `.trim();

        console.log('\n测试旧格式 IP 解析:');
        console.log('  输入:', oldFormatOutput);
        
        const ips = parseWranglerIPs(oldFormatOutput);
        console.log('  解析结果:', ips);
        
        expect(ips).toEqual(['192.168.1.1', '192.168.1.2', '10.0.0.1']);
    });

    it('应该处理错误的 JSON', () => {
        const invalidJson = 'not valid json';
        
        const count = parseWranglerCount(invalidJson);
        const feedIds = parseWranglerFeedIds(invalidJson);
        const ips = parseWranglerIPs(invalidJson);
        
        console.log('\n测试错误 JSON 处理:');
        console.log('  count:', count);
        console.log('  feedIds:', feedIds);
        console.log('  ips:', ips);
        
        expect(count).toBe(0);
        expect(feedIds).toEqual([]);
        expect(ips).toEqual([]);
    });
});
