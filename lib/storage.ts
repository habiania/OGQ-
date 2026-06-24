import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const ROOT = path.join(process.cwd(), "output");

export function newJobId(): string {
  return randomUUID().slice(0, 8);
}

export function jobDir(jobId: string): string {
  return path.join(ROOT, jobId);
}

export async function ensureJob(jobId: string): Promise<string> {
  const dir = jobDir(jobId);
  await fs.mkdir(path.join(dir, "stickers"), { recursive: true });
  return dir;
}

export async function saveFile(jobId: string, rel: string, data: Buffer): Promise<void> {
  const p = path.join(jobDir(jobId), rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
}

export async function readFile(jobId: string, rel: string): Promise<Buffer> {
  return fs.readFile(path.join(jobDir(jobId), rel));
}

export async function listStickers(jobId: string): Promise<string[]> {
  const dir = path.join(jobDir(jobId), "stickers");
  const files = await fs.readdir(dir);
  return files.filter((f) => f.endsWith(".png")).sort();
}
