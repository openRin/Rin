#!/usr/bin/env bun
/**
 * Migration script to convert existing visits data to HyperLogLog format
 * Run this after deploying the new schema (0006.sql)
 * 
 * Usage: bun run scripts/migrate-visits.ts
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { visits, visitStats } from '../src/db/schema';
import { HyperLogLog } from '../src/utils/hyperloglog';
import { eq } from 'drizzle-orm';

const dbPath = process.env.DB_PATH || './data.db';

async function migrate() {
    console.log('Starting visits migration to HyperLogLog format...');
    console.log(`Using database: ${dbPath}`);
    
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);
    
    try {
        // Get all visits grouped by feed_id
        console.log('Fetching visits data...');
        const allVisits = await db.select({
            feedId: visits.feedId,
            ip: visits.ip
        }).from(visits);
        
        // Group by feed_id
        const groupedVisits = new Map<number, string[]>();
        for (const visit of allVisits) {
            if (!groupedVisits.has(visit.feedId)) {
                groupedVisits.set(visit.feedId, []);
            }
            groupedVisits.get(visit.feedId)!.push(visit.ip);
        }
        
        console.log(`Found ${allVisits.length} visits across ${groupedVisits.size} feeds`);
        
        // Process each feed
        let processed = 0;
        for (const [feedId, ips] of groupedVisits) {
            // Check if stats already exist
            const existing = await db.query.visitStats.findFirst({
                where: eq(visitStats.feedId, feedId)
            });
            
            if (existing && existing.hllData) {
                // Already migrated, skip
                console.log(`  Feed ${feedId}: already migrated (skipping)`);
                continue;
            }
            
            // Create HLL from IPs
            const hll = new HyperLogLog();
            for (const ip of ips) {
                hll.add(ip);
            }
            
            const pv = ips.length;
            const uv = Math.round(hll.count());
            const hllData = hll.serialize();
            
            if (existing) {
                // Update existing record
                await db.update(visitStats)
                    .set({ 
                        pv, 
                        hllData,
                        updatedAt: new Date()
                    })
                    .where(eq(visitStats.feedId, feedId));
            } else {
                // Insert new record
                await db.insert(visitStats).values({
                    feedId,
                    pv,
                    hllData
                });
            }
            
            processed++;
            console.log(`  Feed ${feedId}: pv=${pv}, uv=${uv} (estimated)`);
            
            // Progress every 100 feeds
            if (processed % 100 === 0) {
                console.log(`Progress: ${processed}/${groupedVisits.size} feeds processed`);
            }
        }
        
        console.log(`\nMigration complete! Processed ${processed} feeds.`);
        console.log(`Total visits migrated: ${allVisits.length}`);
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        sqlite.close();
    }
}

migrate();
