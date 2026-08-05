export type BackendImportError = {
  row: number;
  column: string;
  code: string;
  message: string;
  value: string | null;
};

export type BackendImportPreviewRow = {
  row: number;
  title: string;
  city: string;
  district: string;
  price: number;
  currency: string;
};

export type BackendImportPreviewResponse = {
  previewToken: string;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  };
  validRows: BackendImportPreviewRow[];
  errors: BackendImportError[];
};

export type BackendImportAnalysisResponse = {
  analysisToken: string;
  sourceType: 'CSV' | 'JSON';
  totalRows: number;
  fields: Array<{
    sourceField: string;
    dataType: 'string' | 'number' | 'unknown';
    sampleValues: string[];
    suggestedTarget: string | null;
    confidence: number;
    transformation: string | null;
    reason: string;
  }>;
  requiredTargetsMissing: string[];
  warnings: string[];
};

export type BackendImportConfirmResponse = {
  summary: {
    totalRows: number;
    createdRows: number;
    failedRows: number;
    skippedRows: number;
  };
  createdListings: Array<{ row: number; id: string; listingNo: string }>;
  errors: BackendImportError[];
};

export type BackendImportMappingItem = {
  sourceField: string;
  targetField: string;
  transformation?: string | null;
};
