// HyperLogLog implementation for cardinality estimation
// Uses 2^14 = 16384 registers with standard error ~0.81%

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
        const hash = this.hash(value);
        const index = hash & (HLL_REGISTERS - 1);
        const leadingZeros = this.countLeadingZeros(hash >>> HLL_BITS);
        this.registers[index] = Math.max(this.registers[index], leadingZeros + 1);
    }

    // Estimate cardinality
    count(): number {
        let sum = 0;
        let zeroCount = 0;

        for (let i = 0; i < HLL_REGISTERS; i++) {
            const val = this.registers[i];
            sum += 1 / (1 << val);
            if (val === 0) zeroCount++;
        }

        const rawEstimate = HLL_ALPHA * HLL_REGISTERS * HLL_REGISTERS / sum;

        // Small range correction
        if (rawEstimate <= 2.5 * HLL_REGISTERS) {
            if (zeroCount !== 0) {
                return HLL_REGISTERS * Math.log(HLL_REGISTERS / zeroCount);
            }
        }

        // Large range correction
        if (rawEstimate > (1 / 30) * (1 << 32)) {
            return -(1 << 32) * Math.log(1 - rawEstimate / (1 << 32));
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
        // Use a simple compression: store only non-zero values with their indices
        const nonZeroEntries: number[] = [];
        for (let i = 0; i < HLL_REGISTERS; i++) {
            if (this.registers[i] !== 0) {
                nonZeroEntries.push(i);
                nonZeroEntries.push(this.registers[i]);
            }
        }
        
        // Convert to Uint8Array
        const data = new Uint8Array(nonZeroEntries.length);
        for (let i = 0; i < nonZeroEntries.length; i++) {
            data[i] = nonZeroEntries[i];
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
            for (let i = 0; i < bytes.length; i += 2) {
                const index = bytes[i];
                const value = bytes[i + 1];
                registers[index] = value;
            }
            return registers;
        } catch {
            return new Uint8Array(HLL_REGISTERS);
        }
    }

    // Simple hash function (MurmurHash3-like)
    private hash(str: string): number {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            h = Math.imul(h ^ char, 0x5bd1e995);
            h = Math.imul(h ^ (h >>> 16), 0x5bd1e995);
        }
        return h >>> 0;
    }

    // Count leading zeros in 32-bit integer
    private countLeadingZeros(x: number): number {
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
