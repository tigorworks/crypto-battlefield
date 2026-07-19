/* ═══════════ CONFIG ═══════════ */
export const STREAM = 'btcusdt';
export const T_SHELL = 40;        // ≥ $40   → tembakan kecil (sangat sering, sangat intens)
export const T_HEAVY = 25000;     // ≥ $25K  → tembakan berat + sorotan
export const T_WHALE = 50000;     // ≥ $50K → paus kecil, unit besar mulai muncul
export const T_BOSS = 2000000;    // ≥ $2jt → peristiwa langka: serangan udara + gerak lambat sinematik
export const MAX_UNITS = 30;
export const CROWD_MAX = 96;      // jumlah maksimum prajurit per sisi (headroom untuk pertempuran padat)
export const CROWD_START = 48;    // jumlah awal prajurit per sisi
export const C_LONG = 0x2dd6a5, C_SHORT = 0xff6584, C_GOLD = 0xffc857, C_GOLD2 = 0xff9f5a;
