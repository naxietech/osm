export const APP_NAME = 'OSES' as const;
export const APP_FULL_NAME = 'On-Screen Exam System' as const;
export const API_BASE_URL = import.meta.env['VITE_API_BASE_URL'] as string;
export const MAX_FILE_SIZE_MB = 50 as const;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const SUPPORTED_SCAN_FORMATS = ['image/tiff', 'application/pdf'] as const;
