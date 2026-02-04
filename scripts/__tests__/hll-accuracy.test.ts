import { describe, it, expect } from 'bun:test';
import { HyperLogLog } from '../../server/src/utils/hyperloglog';

// HLL 误差测试配置
// 
// 重要说明：
// 1. HLL 算法使用 64 位哈希模拟（两个 32 位哈希组合）
// 2. 支持高达数十亿级别的基数估算
// 3. 标准误差约为 0.81%（基于 16384 个寄存器）
// 4. 对于博客/feed 访问统计场景，可支持百万级 UV
//
// 容差设置依据：
// - 小数据量（<100）：HLL 小范围修正有效，误差可控制在 15-50%
// - 中数据量（100-10000）：HLL 表现良好，误差可控制在 3-10%
// - 大数据量（10000-1000000）：HLL 标准误差约 0.81%，设置 3-5% 容差
// - 超大数据量（>1000000）：HLL 依然稳定，设置 2-3% 容差
const TEST_CONFIGS = [
    { scale: '极小', count: 10, tolerance: 0.5 },           // 10 unique IPs, 50% tolerance
    { scale: '很小', count: 50, tolerance: 0.3 },           // 50 unique IPs, 30% tolerance
    { scale: '小', count: 100, tolerance: 0.15 },           // 100 unique IPs, 15% tolerance
    { scale: '中小', count: 500, tolerance: 0.10 },         // 500 unique IPs, 10% tolerance
    { scale: '中', count: 1000, tolerance: 0.08 },          // 1000 unique IPs, 8% tolerance
    { scale: '中大', count: 5000, tolerance: 0.05 },        // 5000 unique IPs, 5% tolerance
    { scale: '大', count: 10000, tolerance: 0.05 },         // 10000 unique IPs, 5% tolerance
    { scale: '很大', count: 100000, tolerance: 0.04 },      // 100000 unique IPs, 4% tolerance
    { scale: '极大', count: 500000, tolerance: 0.03 },      // 500000 unique IPs, 3% tolerance
    { scale: '百万级', count: 1000000, tolerance: 0.03 },   // 1M unique IPs, 3% tolerance
];

// 生成唯一 IP 列表
function generateUniqueIPs(count: number): string[] {
    const ips: string[] = [];
    for (let i = 0; i < count; i++) {
        // 使用更大的地址空间来减少哈希碰撞
        // 使用 UUID 格式的字符串来确保唯一性和分散性
        const segment1 = Math.floor(i / Math.pow(256, 3)) % 256;
        const segment2 = Math.floor(i / Math.pow(256, 2)) % 256;
        const segment3 = Math.floor(i / 256) % 256;
        const segment4 = i % 256;
        const segment5 = Math.floor(i / Math.pow(256, 5)) % 256;
        const segment6 = Math.floor(i / Math.pow(256, 6)) % 256;
        
        // 生成多样化的 IP 格式
        if (i % 3 === 0) {
            // IPv4
            ips.push(`${segment1}.${segment2}.${segment3}.${segment4}`);
        } else if (i % 3 === 1) {
            // IPv6
            const hex1 = (segment1 * 256 + segment2).toString(16).padStart(4, '0');
            const hex2 = (segment3 * 256 + segment4).toString(16).padStart(4, '0');
            ips.push(`2001:0db8:${hex1}:${hex2}::1`);
        } else {
            // 带端口的 IP
            const port = 1000 + (i % 60000);
            ips.push(`${segment5}.${segment6}.${segment3}.${segment4}:${port}`);
        }
    }
    return ips;
}

// 生成带重复的 IP 列表（模拟真实场景）
function generateIPsWithDuplicates(uniqueCount: number, duplicateRatio: number): string[] {
    const ips: string[] = [];
    const uniqueIPs = generateUniqueIPs(uniqueCount);

    // 添加唯一 IP - 使用循环避免栈溢出
    for (const ip of uniqueIPs) {
        ips.push(ip);
    }

    // 添加重复 IP
    const duplicateCount = Math.floor(uniqueCount * duplicateRatio);
    for (let i = 0; i < duplicateCount; i++) {
        const randomIndex = Math.floor(Math.random() * uniqueCount);
        ips.push(uniqueIPs[randomIndex]);
    }

    // 打乱顺序
    for (let i = ips.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = ips[i];
        ips[i] = ips[j];
        ips[j] = temp;
    }

    return ips;
}

// 计算相对误差
function calculateRelativeError(actual: number, expected: number): number {
    if (expected === 0) return 0;
    return Math.abs(actual - expected) / expected;
}

// 统计信息
interface ErrorStats {
    scale: string;
    uniqueCount: number;
    totalCount: number;
    estimatedUV: number;
    actualUV: number;
    relativeError: number;
    tolerance: number;
    passed: boolean;
}

describe('HLL 算法误差测试 - 不同数据规模', () => {
    const results: ErrorStats[] = [];

    for (const config of TEST_CONFIGS) {
        describe(`${config.scale}规模 (${config.count} unique IPs)`, () => {
            it(`应该在 ${config.tolerance * 100}% 误差范围内`, async () => {
                // 生成带 20% 重复的测试数据
                const ips = generateIPsWithDuplicates(config.count, 0.2);
                const actualUnique = config.count;
                const totalVisits = ips.length;

                // 创建 HLL 并添加所有 IP
                const hll = new HyperLogLog();
                for (const ip of ips) {
                    hll.add(ip);
                }

                // 估算 UV
                const estimatedUV = hll.count();
                
                // 处理 NaN 情况（当数据量超出 HLL 算法范围时）
                let relativeError: number;
                let passed: boolean;
                
                if (Number.isNaN(estimatedUV)) {
                    console.log(`\n[${config.scale}] 警告: HLL 估算返回 NaN，数据量可能超出算法范围`);
                    relativeError = Infinity;
                    passed = false;
                } else {
                    relativeError = calculateRelativeError(estimatedUV, actualUnique);
                    passed = relativeError <= config.tolerance;
                }

                // 记录统计信息
                const stats: ErrorStats = {
                    scale: config.scale,
                    uniqueCount: actualUnique,
                    totalCount: totalVisits,
                    estimatedUV: Math.round(estimatedUV),
                    actualUV: actualUnique,
                    relativeError: Math.round(relativeError * 10000) / 10000,
                    tolerance: config.tolerance,
                    passed
                };
                results.push(stats);

                // 输出详细信息
                console.log(`\n[${config.scale}] 唯一IPs: ${actualUnique}, 总访问: ${totalVisits}`);
                console.log(`  实际UV: ${actualUnique}, 估算UV: ${Math.round(estimatedUV)}`);
                console.log(`  相对误差: ${(relativeError * 100).toFixed(2)}%, 容差: ${(config.tolerance * 100).toFixed(1)}%`);
                console.log(`  结果: ${passed ? '✅ 通过' : '❌ 失败'}`);

                expect(relativeError).toBeLessThanOrEqual(config.tolerance);
            });
        });
    }

    it('生成误差统计报告', () => {
        console.log('\n' + '='.repeat(80));
        console.log('HLL 算法误差测试报告');
        console.log('='.repeat(80));
        console.log('\n规模      唯一IP数   总访问数   实际UV     估算UV     误差(%)    容差(%)    结果');
        console.log('-'.repeat(80));

        let totalPassed = 0;
        let totalTests = results.length;

        for (const r of results) {
            const errorPercent = (r.relativeError * 100).toFixed(2).padStart(6);
            const tolerancePercent = (r.tolerance * 100).toFixed(1).padStart(5);
            const result = r.passed ? '✅ 通过' : '❌ 失败';
            
            console.log(
                `${r.scale.padEnd(8)} ` +
                `${r.uniqueCount.toString().padStart(8)} ` +
                `${r.totalCount.toString().padStart(8)} ` +
                `${r.actualUV.toString().padStart(8)} ` +
                `${r.estimatedUV.toString().padStart(8)} ` +
                `${errorPercent.padStart(8)} ` +
                `${tolerancePercent.padStart(8)} ` +
                `${result}`
            );
            
            if (r.passed) totalPassed++;
        }

        console.log('-'.repeat(80));
        console.log(`总计: ${totalPassed}/${totalTests} 通过 (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
        console.log('='.repeat(80));

        expect(totalPassed).toBe(totalTests);
    });
});

describe('HLL 算法误差测试 - 不同重复率场景', () => {
    const REPEAT_RATIOS = [0, 0.1, 0.3, 0.5, 0.7, 0.9];
    const BASE_UNIQUE_COUNT = 1000;

    for (const ratio of REPEAT_RATIOS) {
        describe(`重复率 ${(ratio * 100).toFixed(0)}%`, () => {
            it('应该准确估算唯一IP数', async () => {
                const ips = generateIPsWithDuplicates(BASE_UNIQUE_COUNT, ratio);
                const actualUnique = BASE_UNIQUE_COUNT;

                const hll = new HyperLogLog();
                for (const ip of ips) {
                    hll.add(ip);
                }

                const estimatedUV = hll.count();
                const relativeError = calculateRelativeError(estimatedUV, actualUnique);

                console.log(`\n重复率 ${(ratio * 100).toFixed(0)}%:`);
                console.log(`  唯一IPs: ${actualUnique}, 总访问: ${ips.length}`);
                console.log(`  估算UV: ${Math.round(estimatedUV)}, 误差: ${(relativeError * 100).toFixed(2)}%`);

                // 无论重复率如何，UV 估算应该准确
                expect(relativeError).toBeLessThanOrEqual(0.1);
            });
        });
    }
});

describe('HLL 算法误差测试 - 极端分布场景', () => {
    it('应该处理高度倾斜的访问分布（少数IP大量访问）', async () => {
        const ips: string[] = [];
        const uniqueCount = 100;
        
        // 前 10 个 IP 占 90% 的访问
        const topIPs = generateUniqueIPs(10);
        for (let i = 0; i < 900; i++) {
            ips.push(topIPs[i % 10]);
        }
        
        // 剩余 90 个 IP 各占 1 次访问
        const remainingIPs = generateUniqueIPs(90).slice(10);
        ips.push(...remainingIPs);
        
        const hll = new HyperLogLog();
        for (const ip of ips) {
            hll.add(ip);
        }
        
        const estimatedUV = hll.count();
        const relativeError = calculateRelativeError(estimatedUV, uniqueCount);
        
        console.log('\n高度倾斜分布:');
        console.log(`  唯一IPs: ${uniqueCount}, 总访问: ${ips.length}`);
        console.log(`  估算UV: ${Math.round(estimatedUV)}, 误差: ${(relativeError * 100).toFixed(2)}%`);
        
        expect(relativeError).toBeLessThanOrEqual(0.15);
    });

    it('应该处理均匀分布（每个IP访问次数相近）', async () => {
        const ips: string[] = [];
        const uniqueCount = 100;
        
        // 每个 IP 访问 10 次
        const allIPs = generateUniqueIPs(uniqueCount);
        for (const ip of allIPs) {
            for (let i = 0; i < 10; i++) {
                ips.push(ip);
            }
        }
        
        const hll = new HyperLogLog();
        for (const ip of ips) {
            hll.add(ip);
        }
        
        const estimatedUV = hll.count();
        const relativeError = calculateRelativeError(estimatedUV, uniqueCount);
        
        console.log('\n均匀分布:');
        console.log(`  唯一IPs: ${uniqueCount}, 总访问: ${ips.length}`);
        console.log(`  估算UV: ${Math.round(estimatedUV)}, 误差: ${(relativeError * 100).toFixed(2)}%`);
        
        expect(relativeError).toBeLessThanOrEqual(0.1);
    });

    it('应该处理随机分布', async () => {
        const ips: string[] = [];
        const uniqueCount = 1000;
        const totalVisits = 5000;
        const allIPs = generateUniqueIPs(uniqueCount);
        
        // 随机选择 IP
        for (let i = 0; i < totalVisits; i++) {
            const randomIndex = Math.floor(Math.random() * uniqueCount);
            ips.push(allIPs[randomIndex]);
        }
        
        const hll = new HyperLogLog();
        for (const ip of ips) {
            hll.add(ip);
        }
        
        const estimatedUV = hll.count();
        const relativeError = calculateRelativeError(estimatedUV, uniqueCount);
        
        console.log('\n随机分布:');
        console.log(`  唯一IPs: ${uniqueCount}, 总访问: ${ips.length}`);
        console.log(`  估算UV: ${Math.round(estimatedUV)}, 误差: ${(relativeError * 100).toFixed(2)}%`);
        
        expect(relativeError).toBeLessThanOrEqual(0.1);
    });
});

describe('HLL 算法误差测试 - 连续迁移场景', () => {
    it('应该保持多次迁移的误差一致性', async () => {
        const uniqueCount = 500;
        const ips = generateIPsWithDuplicates(uniqueCount, 0.3);
        
        // 模拟多次迁移（多次序列化/反序列化）
        let hll = new HyperLogLog();
        for (const ip of ips) {
            hll.add(ip);
        }
        
        const estimates: number[] = [];
        for (let i = 0; i < 5; i++) {
            // 序列化并重新创建
            const serialized = hll.serialize();
            hll = new HyperLogLog(serialized);
            estimates.push(hll.count());
        }
        
        // 所有估算值应该相同
        const firstEstimate = estimates[0];
        const allSame = estimates.every(e => e === firstEstimate);
        
        console.log('\n连续迁移测试:');
        console.log(`  唯一IPs: ${uniqueCount}`);
        console.log(`  5次估算: ${estimates.map(e => Math.round(e)).join(', ')}`);
        console.log(`  一致性: ${allSame ? '✅ 通过' : '❌ 失败'}`);
        
        expect(allSame).toBe(true);
    });

    it('应该支持增量迁移（分批处理）', async () => {
        const uniqueCount = 1000;
        const batchSize = 100;
        const allIPs = generateIPsWithDuplicates(uniqueCount, 0.2);
        
        // 分批处理
        let hll = new HyperLogLog();
        let processedCount = 0;
        
        while (processedCount < allIPs.length) {
            const batch = allIPs.slice(processedCount, processedCount + batchSize);
            for (const ip of batch) {
                hll.add(ip);
            }
            processedCount += batch.length;
        }
        
        const estimatedUV = hll.count();
        const relativeError = calculateRelativeError(estimatedUV, uniqueCount);
        
        console.log('\n增量迁移测试:');
        console.log(`  唯一IPs: ${uniqueCount}, 批次大小: ${batchSize}`);
        console.log(`  估算UV: ${Math.round(estimatedUV)}, 误差: ${(relativeError * 100).toFixed(2)}%`);
        
        expect(relativeError).toBeLessThanOrEqual(0.1);
    });
});

describe('HLL 算法误差测试 - 边界条件', () => {
    it('应该处理单个IP', async () => {
        const hll = new HyperLogLog();
        hll.add('192.168.1.1');
        
        const estimatedUV = hll.count();
        const relativeError = calculateRelativeError(estimatedUV, 1);
        
        console.log('\n单个IP测试:');
        console.log(`  估算UV: ${Math.round(estimatedUV)}, 误差: ${(relativeError * 100).toFixed(2)}%`);
        
        expect(estimatedUV).toBeGreaterThan(0);
        expect(estimatedUV).toBeLessThanOrEqual(5);
    });

    it('应该处理两个不同IP', async () => {
        const hll = new HyperLogLog();
        hll.add('192.168.1.1');
        hll.add('192.168.1.2');
        
        const estimatedUV = hll.count();
        const relativeError = calculateRelativeError(estimatedUV, 2);
        
        console.log('\n两个IP测试:');
        console.log(`  估算UV: ${Math.round(estimatedUV)}, 误差: ${(relativeError * 100).toFixed(2)}%`);
        
        expect(estimatedUV).toBeGreaterThan(1);
        expect(estimatedUV).toBeLessThanOrEqual(5);
    });

    it('应该处理大量相同IP', async () => {
        const hll = new HyperLogLog();
        for (let i = 0; i < 10000; i++) {
            hll.add('192.168.1.1');
        }
        
        const estimatedUV = hll.count();
        
        console.log('\n大量相同IP测试:');
        console.log(`  访问次数: 10000, 估算UV: ${Math.round(estimatedUV)}`);
        
        // UV 应该接近 1
        expect(estimatedUV).toBeGreaterThan(0);
        expect(estimatedUV).toBeLessThanOrEqual(3);
    });

    it('应该处理空数据', async () => {
        const hll = new HyperLogLog();
        const estimatedUV = hll.count();
        
        console.log('\n空数据测试:');
        console.log(`  估算UV: ${Math.round(estimatedUV)}`);
        
        expect(estimatedUV).toBe(0);
    });
});
