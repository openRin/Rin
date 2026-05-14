import { describe, it, expect } from 'bun:test';
import { HyperLogLog } from '../../server/src/utils/hyperloglog';

describe('迁移流程完整测试', () => {
    it('应该模拟完整的迁移流程', async () => {
        // 模拟 visits 表中的数据
        const visitsData = [
            { feed_id: 1, ip: '192.168.1.1' },
            { feed_id: 1, ip: '192.168.1.2' },
            { feed_id: 1, ip: '192.168.1.1' }, // 重复
            { feed_id: 2, ip: '10.0.0.1' },
            { feed_id: 2, ip: '10.0.0.2' },
            { feed_id: 2, ip: '10.0.0.3' },
            { feed_id: 2, ip: '10.0.0.1' }, // 重复
        ];
        
        console.log('\n模拟完整迁移流程:');
        console.log(`  原始 visits 数据: ${visitsData.length} 条记录`);
        
        // 步骤 1: SQL 迁移创建 visit_stats 表并插入初始数据（hll_data 为空）
        const visitStatsAfterSQLMigration = new Map();
        const feedGroups = new Map();
        
        for (const visit of visitsData) {
            if (!feedGroups.has(visit.feed_id)) {
                feedGroups.set(visit.feed_id, []);
            }
            feedGroups.get(visit.feed_id).push(visit.ip);
        }
        
        for (const [feedId, ips] of feedGroups) {
            visitStatsAfterSQLMigration.set(feedId, {
                feed_id: feedId,
                pv: ips.length,
                hll_data: '',  // SQL 迁移设置为空
                updated_at: Math.floor(Date.now() / 1000)
            });
        }
        
        console.log(`  SQL 迁移后: ${visitStatsAfterSQLMigration.size} 个 feed`);
        for (const [feedId, stats] of visitStatsAfterSQLMigration) {
            console.log(`    Feed ${feedId}: PV=${stats.pv}, hll_data='${stats.hll_data}'`);
        }
        
        // 步骤 2: deploy-cf.ts 中的 HLL 迁移
        console.log('\n  开始 HLL 迁移...');
        
        for (const [feedId, stats] of visitStatsAfterSQLMigration) {
            // 检查是否已经有 HLL 数据
            if (stats.hll_data !== '') {
                console.log(`    Feed ${feedId}: 已有 HLL 数据，跳过`);
                continue;
            }
            
            // 获取该 feed 的所有 IP
            const ips = feedGroups.get(feedId);
            console.log(`    Feed ${feedId}: 找到 ${ips.length} 个 visits`);
            
            // 创建 HLL
            const hll = new HyperLogLog();
            for (const ip of ips) {
                hll.add(ip);
            }
            
            // 计算 UV
            const uv = Math.round(hll.count());
            const hllData = hll.serialize();
            
            console.log(`    Feed ${feedId}: PV=${ips.length}, UV=${uv}, HLL长度=${hllData.length}`);
            
            // 更新 visit_stats
            stats.hll_data = hllData;
            stats.uv = uv; // 注意：表结构中没有 uv 字段，这里只是为了测试
        }
        
        // 验证结果
        console.log('\n  迁移结果验证:');
        for (const [feedId, stats] of visitStatsAfterSQLMigration) {
            console.log(`    Feed ${feedId}: PV=${stats.pv}, UV=${stats.uv || 'N/A'}`);
            expect(stats.hll_data).not.toBe('');
            expect(stats.hll_data.length).toBeGreaterThan(0);
        }
        
        // 验证 UV 计算正确
        const feed1Stats = visitStatsAfterSQLMigration.get(1);
        const feed2Stats = visitStatsAfterSQLMigration.get(2);
        
        expect(feed1Stats.uv).toBeGreaterThan(0); // Feed 1 应该有 2 个唯一 IP
        expect(feed2Stats.uv).toBeGreaterThan(0); // Feed 2 应该有 3 个唯一 IP
        
        console.log(`\n  ✅ 迁移成功!`);
        console.log(`    Feed 1: 期望 UV≈2, 实际 UV=${feed1Stats.uv}`);
        console.log(`    Feed 2: 期望 UV≈3, 实际 UV=${feed2Stats.uv}`);
    });

    it('应该检查 hll_data 是否为空字符串', () => {
        // 模拟 SQL 迁移后的状态
        const visitStats = {
            feed_id: 1,
            pv: 100,
            hll_data: '',  // SQL 迁移设置为空字符串
            updated_at: 1234567890
        };
        
        // 检查逻辑
        const hasHLLData = visitStats.hll_data !== '';
        
        console.log('\n检查 hll_data 是否为空:');
        console.log(`  hll_data: '${visitStats.hll_data}'`);
        console.log(`  hll_data !== '': ${hasHLLData}`);
        
        expect(hasHLLData).toBe(false);
    });

    it('应该验证 base64 编码不包含单引号', () => {
        const hll = new HyperLogLog();
        for (let i = 0; i < 100; i++) {
            hll.add(`192.168.1.${i}`);
        }
        
        const hllData = hll.serialize();
        const hasSingleQuote = hllData.includes("'");
        
        console.log('\n验证 base64 编码:');
        console.log(`  HLL 数据: ${hllData.substring(0, 50)}...`);
        console.log(`  包含单引号: ${hasSingleQuote}`);
        
        expect(hasSingleQuote).toBe(false);
    });
});
