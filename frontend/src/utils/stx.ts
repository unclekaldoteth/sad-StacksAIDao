export function formatMicroStx(microStx: string): string {
    try {
        const v = BigInt(microStx);
        const stx = v / 1_000_000n;
        const frac = v % 1_000_000n;
        if (frac === 0n) return stx.toString();
        const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
        return `${stx.toString()}.${fracStr}`;
    } catch {
        return microStx;
    }
}

export function shortPrincipal(p: string): string {
    if (p.length <= 12) return p;
    return `${p.slice(0, 6)}...${p.slice(-4)}`;
}

