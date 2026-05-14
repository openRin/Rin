import { describe, it, expect } from 'bun:test';
import { HyperLogLog } from '../../server/src/utils/hyperloglog';
import { HLLTestData, calculateRelativeError } from './test-utils';

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
    { scale: '极小', count: 10, tolerance: 0.5 },
    { scale: '很小', count: 50, tolerance: 0.3 },
    { scale: '小', count: 100, tolerance: 0.15 },
    { scale: '中小', count: 500, tolerance: 0.10 },
    { scale: '中', count: 1000, tolerance: 0.08 },
    { scale: '中大', count: 5000, tolerance: 0.05 },
    { scale: '大', count: 10000, tolerance: 0.05 },
    { scale: '很大', count: 100000, tolerance: 0.04 },
    { scale: '极大', count: 500000, tolerance: 0.03 },
    { scale: '百万级', count: 1000000, tolerance: 0.03 },
];

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
                const ips = HLLTestData.generateIPsWithDuplicates(config.count, 0.2);
                const actualUnique = config.count;
                const totalVisits = ips.length;

                const hll = new HyperLogLog();
                for (const ip of ips) {
                    hll.add(ip);
                }

                const estimatedUV = hll.count();
                
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
                const ips = HLLTestData.generateIPsWithDuplicates(BASE_UNIQUE_COUNT, ratio);
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

                expect(relativeError).toBeLessThanOrEqual(0.1);
            });
        });
    }
});

describe('HLL 算法误差测试 - 极端分布场景', () => {
    it('应该处理高度倾斜的访问分布（少数IP大量访问）', async () => {
        const ips: string[] = [];
        const uniqueCount = 100;
        
        const topIPs = HLLTestData.generateUniqueIPs(10);
        for (let i = 0; i < 900; i++) {
            ips.push(topIPs[i % 10]);
        }
        
        const remainingIPs = HLLTestData.generateUniqueIPs(90).slice(10);
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
        
        const allIPs = HLLTestData.generateUniqueIPs(uniqueCount);
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
        const allIPs = HLLTestData.generateUniqueIPs(uniqueCount);
        
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
        const ips = HLLTestData.generateIPsWithDuplicates(uniqueCount, 0.3);
        
        let hll = new HyperLogLog();
        for (const ip of ips) {
            hll.add(ip);
        }
        
        const estimates: number[] = [];
        for (let i = 0; i < 5; i++) {
            const serialized = hll.serialize();
            hll = new HyperLogLog(serialized);
            estimates.push(hll.count());
        }
        
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
        const allIPs = HLLTestData.generateIPsWithDuplicates(uniqueCount, 0.2);
        
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
