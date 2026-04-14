/**
 * File Adapter — V4 Pipeline Integration
 *
 * Extracts structured clinical data from uploaded files:
 * - PDFs: text extraction (basic)
 * - Images: placeholder metadata
 * - Lab reports: structured lab result extraction
 *
 * Output feeds into SessionContextManager.
 *
 * 🚫 RAW STRING USAGE FORBIDDEN BEYOND EXTRACTION
 */

import type { PipelineLabResult } from "../pipeline/types";
import type { UploadedFile } from "../session_context/types";

/**
 * Process an uploaded file and extract structured data.
 * Returns an UploadedFile with extracted content.
 */
export async function processUploadedFile(
  file: File
): Promise<UploadedFile> {
  const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fileType = detectFileType(file);

  const result: UploadedFile = {
    file_id: fileId,
    file_name: file.name,
    file_type: fileType,
    uploaded_at: new Date().toISOString(),
  };

  if (fileType === "pdf" || fileType === "lab_report") {
    result.extracted_text = await extractTextFromFile(file);
    if (result.extracted_text) {
      result.extracted_labs = extractLabResults(result.extracted_text);
    }
  }

  return result;
}

/**
 * Detect file type from MIME type and name.
 */
function detectFileType(file: File): UploadedFile["file_type"] {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (file.name.toLowerCase().includes("lab") || file.name.toLowerCase().includes("report")) {
    return "lab_report";
  }
  return "other";
}

/**
 * Extract text from a file (basic text extraction).
 * For PDFs, uses FileReader for text content.
 * Full PDF parsing would use a dedicated library.
 */
async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      resolve(text);
    };
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

/**
 * Extract structured lab results from text.
 * Pattern: parameter_name: value unit (reference_range)
 */
function extractLabResults(text: string): PipelineLabResult[] {
  const results: PipelineLabResult[] = [];
  const lines = text.split("\n");

  // Common lab patterns
  const LAB_PATTERNS = [
    /^(.+?):\s*([\d.]+)\s*([a-zA-Z/%]+)?\s*(?:\((.+?)\))?$/,
    /^(.+?)\s+([\d.]+)\s*([a-zA-Z/%]+)\s*(?:ref[:\s]*(.+))?$/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of LAB_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        results.push({
          parameter: match[1].trim(),
          value: match[2],
          unit: match[3] || null,
          reference_range: match[4] || null,
          is_abnormal: null,
        });
        break;
      }
    }
  }

  return results;
}
