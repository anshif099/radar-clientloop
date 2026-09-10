import { z } from "zod";

export const writingCorrectionSchema = z.object({
  correctedText: z.string().max(10_000),
  changes: z.array(z.string().max(300)).max(20),
  language: z.string().max(80),
});

export type WritingCorrection = z.infer<typeof writingCorrectionSchema>;

export const revisionCheckSchema = z.object({
  verdict: z.enum(["READY", "NEEDS_ATTENTION", "UNCERTAIN"]),
  summary: z.string().max(1_500),
  requirements: z.array(z.object({
    request: z.string().max(1_000),
    status: z.enum(["MET", "MISSING", "UNCERTAIN"]),
    evidence: z.string().max(1_500),
  })).max(30),
  visualChanges: z.array(z.string().max(500)).max(30),
  warnings: z.array(z.string().max(500)).max(20),
});

export type RevisionCheck = z.infer<typeof revisionCheckSchema> & {
  compared: { fromVersion: number; toVersion: number };
};
