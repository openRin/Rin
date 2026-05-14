import { describe, it, expect } from 'bun:test';
import { HyperLogLog } from '../../server/src/utils/hyperloglog';

// 生成唯一 IP 列表
function generateUniqueIPs(count: number): string[] {
    const ips: string[] = [];
    for (let i = 0; i < count; i++) {
        const segment1 = Math.floor(i / Math.pow(256, 3)) % 256;
        const segment2 = Math.floor(i / Math.pow(256, 2)) % 256;
        const segment3 = Math.floor(i / 256) % 256;
        const segment4 = i % 256;
        const segment5 = Math.floor(i / Math.pow(256, 5)) % 256;
        const segment6 = Math.floor(i / Math.pow(256, 6)) % 256;
        
        if (i % 3 === 0) {
            ips.push(`${segment1}.${segment2}.${segment3}.${segment4}`);
        } else if (i % 3 === 1) {
            const hex1 = (segment1 * 256 + segment2).toString(16).padStart(4, '0');
            const hex2 = (segment3 * 256 + segment4).toString(16).padStart(4, '0');
            ips.push(`2001:0db8:${hex1}:${hex2}::1`);
        } else {
            const port = 1000 + (i % 60000);
            ips.push(`${segment5}.${segment6}.${segment3}.${segment4}:${port}`);
        }
    }
    return ips;
}

// 计算相对误差
function calculateRelativeError(actual: number, expected: number): number {
    if (expected === 0) return 0;
    return Math.abs(actual - expected) / expected;
}

/**
 * 检查是否应该运行大规模测试
 * 通过环境变量 HLL_TEST_LARGE_SCALE 控制
 * 设置 HLL_TEST_LARGE_SCALE=true 时才会运行千万级以上测试
 */
function shouldRunLargeScaleTests(): boolean {
    return process.env.HLL_TEST_LARGE_SCALE === 'true';
}

describe('HLL 最大数据规模测试', () => {
    // 基础测试配置（始终运行）
    const BASE_SCALE_TESTS = [
        { name: '十万级', count: 100_000, tolerance: 0.05 },
        { name: '百万级', count: 1_000_000, tolerance: 0.05 },
    ];

    // 大规模测试配置（仅在启用时运行）
    const LARGE_SCALE_TESTS = [
        { name: '千万级', count: 10_000_000, tolerance: 0.05 },
        { name: '亿级', count: 100_000_000, tolerance: 0.05 },
        { name: '十亿级', count: 1_000_000_000, tolerance: 0.10 },
    ];

    // 运行基础测试
    for (const test of BASE_SCALE_TESTS) {
        describe(`${test.name} (${test.count.toLocaleString()} unique IPs)`, () => {
            it(`应该在 ${(test.tolerance * 100).toFixed(0)}% 误差范围内`, async () => {
                console.log(`\n开始测试 ${test.name} 规模...`);
                const startTime = Date.now();
                
                const hll = new HyperLogLog();
                const batchSize = 100000;
                const batches = Math.ceil(test.count / batchSize);
                
                for (let batch = 0; batch < batches; batch++) {
                    const start = batch * batchSize;
                    const end = Math.min((batch + 1) * batchSize, test.count);
                    
                    for (let i = start; i < end; i++) {
                        const segment1 = Math.floor(i / Math.pow(256, 3)) % 256;
                        const segment2 = Math.floor(i / Math.pow(256, 2)) % 256;
                        const segment3 = Math.floor(i / 256) % 256;
                        const segment4 = i % 256;
                        const ip = `${segment1}.${segment2}.${segment3}.${segment4}`;
                        hll.add(ip);
                    }
                    
                    if ((batch + 1) % 10 === 0 || batch === batches - 1) {
                        const progress = ((batch + 1) / batches * 100).toFixed(1);
                        console.log(`  进度: ${progress}% (${(batch + 1) * batchSize}/${test.count})`);
                    }
                }
                
                const estimatedUV = hll.count();
                const relativeError = calculateRelativeError(estimatedUV, test.count);
                const elapsed = Date.now() - startTime;
                
                console.log(`\n${test.name} 测试结果:`);
                console.log(`  实际UV: ${test.count.toLocaleString()}`);
                console.log(`  估算UV: ${Math.round(estimatedUV).toLocaleString()}`);
                console.log(`  相对误差: ${(relativeError * 100).toFixed(2)}%`);
                console.log(`  容差: ${(test.tolerance * 100).toFixed(0)}%`);
                console.log(`  耗时: ${(elapsed / 1000).toFixed(2)}秒`);
                console.log(`  结果: ${relativeError <= test.tolerance ? '✅ 通过' : '❌ 失败'}`);
                
                expect(relativeError).toBeLessThanOrEqual(test.tolerance);
            }, 120000); // 2分钟超时
        });
    }

    // 条件性运行大规模测试
    if (shouldRunLargeScaleTests()) {
        console.log('\n⚠️  检测到 HLL_TEST_LARGE_SCALE=true，将运行大规模测试（千万级以上）');
        console.log('   这些测试可能需要数分钟时间，请耐心等待...\n');
        
        for (const test of LARGE_SCALE_TESTS) {
            describe(`${test.name} (${test.count.toLocaleString()} unique IPs)`, () => {
                it(`应该在 ${(test.tolerance * 100).toFixed(0)}% 误差范围内`, async () => {
                    console.log(`\n开始测试 ${test.name} 规模...`);
                    const startTime = Date.now();
                    
                    const hll = new HyperLogLog();
                    const batchSize = 100000;
                    const batches = Math.ceil(test.count / batchSize);
                    
                    for (let batch = 0; batch < batches; batch++) {
                        const start = batch * batchSize;
                        const end = Math.min((batch + 1) * batchSize, test.count);
                        
                        for (let i = start; i < end; i++) {
                            const segment1 = Math.floor(i / Math.pow(256, 3)) % 256;
                            const segment2 = Math.floor(i / Math.pow(256, 2)) % 256;
                            const segment3 = Math.floor(i / 256) % 256;
                            const segment4 = i % 256;
                            const ip = `${segment1}.${segment2}.${segment3}.${segment4}`;
                            hll.add(ip);
                        }
                        
                        if ((batch + 1) % 10 === 0 || batch === batches - 1) {
                            const progress = ((batch + 1) / batches * 100).toFixed(1);
                            console.log(`  进度: ${progress}% (${(batch + 1) * batchSize}/${test.count})`);
                        }
                    }
                    
                    const estimatedUV = hll.count();
                    const relativeError = calculateRelativeError(estimatedUV, test.count);
                    const elapsed = Date.now() - startTime;
                    
                    console.log(`\n${test.name} 测试结果:`);
                    console.log(`  实际UV: ${test.count.toLocaleString()}`);
                    console.log(`  估算UV: ${Math.round(estimatedUV).toLocaleString()}`);
                    console.log(`  相对误差: ${(relativeError * 100).toFixed(2)}%`);
                    console.log(`  容差: ${(test.tolerance * 100).toFixed(0)}%`);
                    console.log(`  耗时: ${(elapsed / 1000).toFixed(2)}秒`);
                    console.log(`  结果: ${relativeError <= test.tolerance ? '✅ 通过' : '❌ 失败'}`);
                    
                    expect(relativeError).toBeLessThanOrEqual(test.tolerance);
                }, 600000); // 10分钟超时
            });
        }
    } else {
        it('跳过大规模测试（设置 HLL_TEST_LARGE_SCALE=true 以启用）', () => {
            console.log('\n⏭️  跳过千万级以上测试');
            console.log('   设置环境变量 HLL_TEST_LARGE_SCALE=true 以运行这些测试');
            console.log('   例如: HLL_TEST_LARGE_SCALE=true bun test scripts/__tests__/hll-scale.test.ts');
            expect(true).toBe(true);
        });
    }
});

describe('HLL 序列化数据大小测试', () => {
    it('应该测试不同规模下的序列化大小', async () => {
        const sizes = [100, 1000, 10000, 100000, 1000000];
        
        console.log('\n' + '='.repeat(80));
        console.log('HLL 序列化数据大小测试');
        console.log('='.repeat(80));
        console.log('\n数据规模      序列化大小    压缩率      估算准确性');
        console.log('-'.repeat(80));
        
        for (const size of sizes) {
            const hll = new HyperLogLog();
            const ips = generateUniqueIPs(size);
            
            for (const ip of ips) {
                hll.add(ip);
            }
            
            const serialized = hll.serialize();
            const sizeInBytes = new Blob([serialized]).size;
            const sizeInKB = (sizeInBytes / 1024).toFixed(2);
            
            // 理论原始数据大小（假设每个 IP 平均 15 字节）
            const rawSize = size * 15;
            const compressionRatio = (rawSize / sizeInBytes).toFixed(1);
            
            const estimatedUV = hll.count();
            const error = calculateRelativeError(estimatedUV, size);
            
            console.log(
                `${size.toString().padStart(10)} ` +
                `${sizeInKB.padStart(10)}KB ` +
                `${compressionRatio.padStart(10)}x ` +
                `${(error * 100).toFixed(2).padStart(10)}%`
            );
        }
        
        console.log('-'.repeat(80));
    });
});

describe('HLL 内存使用测试', () => {
    it('应该测试不同规模下的内存占用', async () => {
        const sizes = [1000, 10000, 100000, 1000000];
        
        console.log('\n' + '='.repeat(80));
        console.log('HLL 内存使用测试');
        console.log('='.repeat(80));
        console.log('\n数据规模      寄存器数量    内存占用(估算)   每万UV内存');
        console.log('-'.repeat(80));
        
        for (const size of sizes) {
            const hll = new HyperLogLog();
            const ips = generateUniqueIPs(size);
            
            for (const ip of ips) {
                hll.add(ip);
            }
            
            const registers = hll.getRegisters();
            const registerCount = registers.length;
            const memoryBytes = registerCount; // Uint8Array 每个元素 1 字节
            const memoryKB = (memoryBytes / 1024).toFixed(2);
            const per10k = ((memoryBytes / size) * 10000).toFixed(2);
            
            console.log(
                `${size.toString().padStart(10)} ` +
                `${registerCount.toString().padStart(12)} ` +
                `${memoryKB.padStart(12)}KB ` +
                `${per10k.padStart(12)} bytes`
            );
        }
        
        console.log('-'.repeat(80));
        console.log('注: HLL 内存占用固定为 16384 字节（16384 个寄存器），与数据规模无关');
        console.log('='.repeat(80));
    });
});

describe('HLL 数据库字段兼容性测试', () => {
    it('应该验证序列化数据适合数据库存储', async () => {
        const hll = new HyperLogLog();
        
        // 添加百万级数据
        const millionIPs = generateUniqueIPs(1000000);
        for (const ip of millionIPs) {
            hll.add(ip);
        }
        
        const serialized = hll.serialize();
        
        // 检查各种数据库字段类型的兼容性
        console.log('\n' + '='.repeat(80));
        console.log('HLL 数据库字段兼容性测试');
        console.log('='.repeat(80));
        
        const sizeInBytes = new Blob([serialized]).size;
        console.log(`\n序列化数据大小: ${sizeInBytes} 字节 (${(sizeInBytes / 1024).toFixed(2)} KB)`);
        console.log(`Base64 字符串长度: ${serialized.length} 字符`);
        
        // 检查常见数据库字段类型
        console.log('\n数据库字段类型兼容性:');
        console.log('-'.repeat(80));
        
        const fieldTypes = [
            { type: 'SQLite TEXT', maxSize: 1_000_000_000, compatible: serialized.length <= 1_000_000_000 },
            { type: 'MySQL VARCHAR(65535)', maxSize: 65535, compatible: serialized.length <= 65535 },
            { type: 'MySQL TEXT', maxSize: 65535, compatible: serialized.length <= 65535 },
            { type: 'MySQL MEDIUMTEXT', maxSize: 16_777_215, compatible: serialized.length <= 16_777_215 },
            { type: 'PostgreSQL TEXT', maxSize: 1_000_000_000, compatible: serialized.length <= 1_000_000_000 },
            { type: 'SQL Server VARCHAR(MAX)', maxSize: 2_147_483_647, compatible: serialized.length <= 2_147_483_647 },
            { type: 'Oracle CLOB', maxSize: 4_294_967_296, compatible: serialized.length <= 4_294_967_296 },
        ];
        
        for (const field of fieldTypes) {
            const status = field.compatible ? '✅ 兼容' : '❌ 不兼容';
            console.log(`${field.type.padEnd(30)} ${status}`);
        }
        
        console.log('-'.repeat(80));
        
        // 验证反序列化
        const deserialized = new HyperLogLog(serialized);
        const originalCount = hll.count();
        const deserializedCount = deserialized.count();
        
        console.log('\n序列化/反序列化一致性:');
        console.log(`  原始估算: ${Math.round(originalCount)}`);
        console.log(`  反序列化后: ${Math.round(deserializedCount)}`);
        console.log(`  一致性: ${originalCount === deserializedCount ? '✅ 通过' : '❌ 失败'}`);
        
        expect(originalCount).toBe(deserializedCount);
        
        console.log('='.repeat(80));
    });
});
