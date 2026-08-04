export type SourceRow = { row: number; values: Record<string, string> };
export type SourceDataset = { sourceType: 'CSV' | 'JSON'; fields: string[]; rows: SourceRow[]; warnings: string[]; delimiter?: string };
