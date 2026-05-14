// HyperLogLog implementation for cardinality estimation
// Uses 2^14 = 16384 registers with standard error ~0.81%
// Supports cardinality up to billions with proper 64-bit hash simulation

const HLL_BITS = 14; // Number of bits for register index
const HLL_REGISTERS = 1 << HLL_BITS; // 16384 registers
const HLL_ALPHA = 0.7213 / (1 + 1.079 / HLL_REGISTERS); // Bias correction constant

export class HyperLogLog {
    private registers: Uint8Array;

    constructor(initialData?: Uint8Array | string) {
        if (initialData instanceof Uint8Array) {
            this.registers = initialData;
        } else if (typeof initialData === 'string') {
            this.registers = this.deserialize(initialData);
        } else {
            this.registers = new Uint8Array(HLL_REGISTERS);
        }
    }

    // Add an element to the HLL
    add(value: string): void {
        // Generate 64-bit hash using two independent 32-bit hashes
        const hash1 = this.hash32(value, 0);
        const hash2 = this.hash32(value, 1);
        
        // Use lower 14 bits of first hash for register index
        const index = hash1 & (HLL_REGISTERS - 1);
        
        // Use remaining 50 bits (18 from hash1 + 32 from hash2) for leading zeros
        // This allows HLL to support cardinalities up to 2^50
        const leadingZeros = this.countLeadingZeros50(hash1 >>> HLL_BITS, hash2);
        
        this.registers[index] = Math.max(this.registers[index], Math.min(leadingZeros + 1, 50));
    }

    // Estimate cardinality
    count(): number {
        let sum = 0;
        let zeroCount = 0;

        for (let i = 0; i < HLL_REGISTERS; i++) {
            const val = this.registers[i];
            sum += 1 / Math.pow(2, val);
            if (val === 0) zeroCount++;
        }

        const rawEstimate = HLL_ALPHA * HLL_REGISTERS * HLL_REGISTERS / sum;

        // Small range correction (Linear Counting)
        // When rawEstimate < 2.5 * m, use linear counting for better accuracy
        if (rawEstimate <= 2.5 * HLL_REGISTERS) {
            if (zeroCount !== 0) {
                return HLL_REGISTERS * Math.log(HLL_REGISTERS / zeroCount);
            }
        }

        // Large range correction for 64-bit HLL
        // When rawEstimate > 2^32 / 30, apply 64-bit correction
        const largeThreshold = Math.pow(2, 32) / 30;
        if (rawEstimate > largeThreshold) {
            // For very large cardinalities, return raw estimate
            // The 50-bit hash space allows accurate estimation up to billions
            return rawEstimate;
        }

        return rawEstimate;
    }

    // Merge another HLL into this one
    merge(other: HyperLogLog): void {
        for (let i = 0; i < HLL_REGISTERS; i++) {
            this.registers[i] = Math.max(this.registers[i], other.registers[i]);
        }
    }

    // Serialize to base64 string
    serialize(): string {
        // Store non-zero registers with 16-bit indices
        // Format: [index_high, index_low, value, index_high, index_low, value, ...]
        const entries: number[] = [];
        for (let i = 0; i < HLL_REGISTERS; i++) {
            if (this.registers[i] !== 0) {
                // Store index as two bytes (16-bit)
                entries.push((i >> 8) & 0xFF); // High byte
                entries.push(i & 0xFF);        // Low byte
                entries.push(this.registers[i]); // Value (8-bit, max 50)
            }
        }
        
        // Convert to Uint8Array
        const data = new Uint8Array(entries.length);
        for (let i = 0; i < entries.length; i++) {
            data[i] = entries[i];
        }
        
        // Convert to base64
        return btoa(String.fromCharCode(...data));
    }

    // Deserialize from base64 string
    private deserialize(data: string): Uint8Array {
        try {
            const binary = atob(data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            
            const registers = new Uint8Array(HLL_REGISTERS);
            // Each entry is 3 bytes: index_high, index_low, value
            for (let i = 0; i < bytes.length; i += 3) {
                const index = (bytes[i] << 8) | bytes[i + 1];
                const value = bytes[i + 2];
                if (index < HLL_REGISTERS) {
                    registers[index] = value;
                }
            }
            return registers;
        } catch {
            return new Uint8Array(HLL_REGISTERS);
        }
    }

    // 32-bit hash function using MurmurHash3 algorithm
    private hash32(str: string, seed: number): number {
        const c1 = 0xcc9e2d51;
        const c2 = 0x1b873593;
        const r1 = 15;
        const r2 = 13;
        const m = 5;
        const n = 0xe6546b64;
        
        let hash = seed;
        
        // Process string in 4-byte chunks
        for (let i = 0; i < str.length - 3; i += 4) {
            let k = (str.charCodeAt(i)) |
                    (str.charCodeAt(i + 1) << 8) |
                    (str.charCodeAt(i + 2) << 16) |
                    (str.charCodeAt(i + 3) << 24);
            
            k = Math.imul(k, c1);
            k = (k << r1) | (k >>> (32 - r1));
            k = Math.imul(k, c2);
            
            hash ^= k;
            hash = (hash << r2) | (hash >>> (32 - r2));
            hash = Math.imul(hash, m) + n;
        }
        
        // Handle remaining bytes
        let k = 0;
        const remaining = str.length % 4;
        for (let i = str.length - remaining; i < str.length; i++) {
            k <<= 8;
            k |= str.charCodeAt(i);
        }
        
        if (remaining > 0) {
            k = Math.imul(k, c1);
            k = (k << r1) | (k >>> (32 - r1));
            k = Math.imul(k, c2);
            hash ^= k;
        }
        
        // Finalization
        hash ^= str.length;
        hash ^= hash >>> 16;
        hash = Math.imul(hash, 0x85ebca6b);
        hash ^= hash >>> 13;
        hash = Math.imul(hash, 0xc2b2ae35);
        hash ^= hash >>> 16;
        
        return hash >>> 0;
    }

    // Count leading zeros in 50-bit integer
    // high18: upper 18 bits (from first hash after removing 14 index bits)
    // low32: lower 32 bits (from second hash)
    private countLeadingZeros50(high18: number, low32: number): number {
        // high18 contains bits 14-31 of the first hash (18 bits)
        // low32 contains all 32 bits of the second hash
        
        if (high18 !== 0) {
            // Count leading zeros in high18
            // high18 uses 18 bits, so we need to count zeros in the upper 18 bits
            const clz = this.countLeadingZeros32(high18);
            return clz - 14; // Subtract 14 because high18 only uses 18 bits
        } else if (low32 !== 0) {
            // high18 is 0, so we have 18 leading zeros from high18
            // plus the leading zeros in low32
            return 18 + this.countLeadingZeros32(low32);
        }
        
        // Both are zero
        return 50;
    }

    // Count leading zeros in 32-bit integer
    private countLeadingZeros32(x: number): number {
        if (x === 0) return 32;
        let n = 0;
        if ((x & 0xFFFF0000) === 0) { n += 16; x <<= 16; }
        if ((x & 0xFF000000) === 0) { n += 8; x <<= 8; }
        if ((x & 0xF0000000) === 0) { n += 4; x <<= 4; }
        if ((x & 0xC0000000) === 0) { n += 2; x <<= 2; }
        if ((x & 0x80000000) === 0) { n += 1; }
        return n;
    }

    // Get raw register data
    getRegisters(): Uint8Array {
        return this.registers;
    }
}

// Utility functions for managing visit stats
export function createHLL(): HyperLogLog {
    return new HyperLogLog();
}

export function hllFromString(data: string): HyperLogLog {
    return new HyperLogLog(data);
}
