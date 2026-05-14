import { describe, it, expect } from 'bun:test';
import { HyperLogLog } from '../../server/src/utils/hyperloglog';

// 模拟 deploy-cf.ts 中的迁移函数
async function generateHLLData(ips: string[]): Promise<string> {
    const { HyperLogLog } = await import('../../server/src/utils/hyperloglog');
    const hll = new HyperLogLog();
    for (const ip of ips) {
        hll.add(ip);
    }
    return hll.serialize();
}

async function estimateUV(hllData: string): Promise<number> {
    const { HyperLogLog } = await import('../../server/src/utils/hyperloglog');
    const hll = new HyperLogLog(hllData);
    return hll.count();
}

describe('迁移脚本 UV 计算测试', () => {
    it('应该正确计算 UV 而不是返回 0', async () => {
        // 模拟真实 IP 数据
        const ips = [
            '192.168.1.1',
            '192.168.1.2',
            '192.168.1.3',
            '192.168.1.1', // 重复
            '192.168.1.2', // 重复
            '10.0.0.1',
            '172.16.0.1',
        ];
        
        console.log('\n测试迁移脚本 UV 计算:');
        console.log(`  输入 IP 数: ${ips.length}`);
        console.log(`  唯一 IP 数: ${new Set(ips).size}`);
        
        // 生成 HLL 数据
        const hllData = await generateHLLData(ips);
        console.log(`  HLL 数据长度: ${hllData.length}`);
        console.log(`  HLL 数据前 50 字符: ${hllData.substring(0, 50)}...`);
        
        // 计算 UV
        const uv = await estimateUV(hllData);
        console.log(`  计算出的 UV: ${uv}`);
        
        // UV 不应该为 0
        expect(uv).toBeGreaterThan(0);
        expect(uv).toBeGreaterThanOrEqual(4); // 至少有 4 个唯一 IP
        expect(uv).toBeLessThanOrEqual(10); // 最多 7 个 IP
    });

    it('应该正确处理空 IP 列表', async () => {
        const ips: string[] = [];
        
        const hllData = await generateHLLData(ips);
        const uv = await estimateUV(hllData);
        
        console.log('\n测试空 IP 列表:');
        console.log(`  UV: ${uv}`);
        
        expect(uv).toBe(0);
    });

    it('应该正确处理单个 IP', async () => {
        const ips = ['192.168.1.1'];
        
        const hllData = await generateHLLData(ips);
        const uv = await estimateUV(hllData);
        
        console.log('\n测试单个 IP:');
        console.log(`  UV: ${uv}`);
        
        expect(uv).toBeGreaterThan(0);
    });

    it('应该正确处理大量 IP', async () => {
        const ips: string[] = [];
        for (let i = 0; i < 100; i++) {
            ips.push(`192.168.${Math.floor(i / 256)}.${i % 256}`);
        }
        
        const hllData = await generateHLLData(ips);
        const uv = await estimateUV(hllData);
        
        console.log('\n测试 100 个唯一 IP:');
        console.log(`  期望 UV: 100`);
        console.log(`  实际 UV: ${uv}`);
        
        expect(uv).toBeGreaterThan(80);
        expect(uv).toBeLessThan(120);
    });

    it('应该正确处理从 wrangler 输出解析的 IP', async () => {
        // 模拟 wrangler d1 execute 的输出格式
        const wranglerOutput = `
ip
192.168.1.1
192.168.1.2
192.168.1.3
192.168.1.1
10.0.0.1
        `.trim();
        
        // 模拟迁移脚本中的解析逻辑
        const ips = wranglerOutput
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !/^\d+$/.test(line) && line !== 'ip');
        
        console.log('\n测试 wrangler 输出解析:');
        console.log(`  原始输出:\n${wranglerOutput}`);
        console.log(`  解析后的 IPs: ${JSON.stringify(ips)}`);
        console.log(`  IP 数量: ${ips.length}`);
        
        expect(ips.length).toBeGreaterThan(0);
        
        const hllData = await generateHLLData(ips);
        const uv = await estimateUV(hllData);
        
        console.log(`  计算出的 UV: ${uv}`);
        
        expect(uv).toBeGreaterThan(0);
    });

    it('应该验证 HLL 序列化和反序列化一致性', async () => {
        const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
        
        // 创建 HLL 并添加 IP
        const { HyperLogLog } = await import('../../server/src/utils/hyperloglog');
        const hll1 = new HyperLogLog();
        for (const ip of ips) {
            hll1.add(ip);
        }
        
        const count1 = hll1.count();
        const serialized = hll1.serialize();
        
        // 反序列化
        const hll2 = new HyperLogLog(serialized);
        const count2 = hll2.count();
        
        console.log('\n测试序列化一致性:');
        console.log(`  原始计数: ${count1}`);
        console.log(`  反序列化后计数: ${count2}`);
        console.log(`  序列化数据长度: ${serialized.length}`);
        
        expect(count1).toBe(count2);
    });
});
