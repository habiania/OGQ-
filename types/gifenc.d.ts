declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        transparent?: boolean;
        transparentIndex?: number;
        delay?: number;
        dispose?: number;
        repeat?: number;
        first?: boolean;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string; oneBitAlpha?: boolean | number; clearAlpha?: boolean }
  ): number[][];
  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string
  ): Uint8Array;
}
