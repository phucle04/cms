import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import { GEMINI_MODEL } from '../config/env';
import { withGeminiRetry } from './geminiVideoService';
import type { KnowledgeStoreType, DiscCode } from '../models/KnowledgeEntry';

/**
 * Đọc file kiến thức (hook / pain point / DISC) do người dùng upload và tách
 * thành từng entry riêng lẻ. Hỗ trợ 2 nhóm định dạng:
 *  - .xlsx/.xls/.csv: có cấu trúc cột sẵn -> đọc thẳng, KHÔNG gọi AI (rẻ, chính xác).
 *  - .docx/.pdf/.txt: văn bản tự do -> gửi Gemini để tự tách thành entry.
 * Toàn bộ entry trả về được controller lưu với source='uploaded',
 * status='approved' luôn (khác entry AI tự học lúc phân tích video, LUÔN ở
 * 'pending' - xem server/models/KnowledgeEntry.ts).
 */

export interface ParsedKnowledgeEntry {
  name: string;
  description: string;
  example?: string;
  discCode?: DiscCode;
}

const MAX_TEXT_CHARS = 60_000; // chặn file quá dài tốn token Gemini vô ích

let cachedClient: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('FATAL: GEMINI_API_KEY is missing - không thể trích xuất kiến thức từ file');
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

const STORE_LABEL: Record<KnowledgeStoreType, string> = {
  hook: 'công thức HOOK mở đầu video ngắn (kỹ thuật giữ chân người xem trong vài giây đầu)',
  pain_point: 'khung phân loại NỖI ĐAU khách hàng (pain point) dùng trong content bán hàng',
  disc: 'kiểu TÍNH CÁCH khách hàng theo mô hình DISC (Dominance/Influence/Steadiness/Conscientiousness)',
};

async function extractEntriesFromText(
  storeType: KnowledgeStoreType,
  rawText: string
): Promise<ParsedKnowledgeEntry[]> {
  const text = rawText.trim().slice(0, MAX_TEXT_CHARS);
  if (!text) return [];

  const isDisc = storeType === 'disc';
  const discNote = isDisc
    ? ' Mỗi entry BẮT BUỘC có "discCode" là đúng 1 trong 4 giá trị "D", "I", "S", "C" khớp với kiểu tính cách được mô tả trong entry đó.'
    : '';

  const responseSchema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        example: { type: 'string' },
        ...(isDisc ? { discCode: { type: 'string', enum: ['D', 'I', 'S', 'C'] } } : {}),
      },
      required: isDisc ? ['name', 'description', 'discCode'] : ['name', 'description'],
    },
  } as const;

  const client = getClient();

  return withGeminiRetry(async () => {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Tài liệu nguồn:\n"""\n${text}\n"""\n\nTrích xuất TOÀN BỘ các mục kiến thức riêng biệt có trong tài liệu trên.` }],
        },
      ],
      config: {
        systemInstruction: `Bạn là chuyên gia phân loại tri thức copywriting. Nhiệm vụ: đọc tài liệu do người dùng cung cấp và tách thành danh sách các mục riêng biệt thuộc loại: ${STORE_LABEL[storeType]}. Mỗi mục cần có "name" (tên ngắn gọn dễ nhận diện), "description" (mô tả/công thức đầy đủ để người viết kịch bản áp dụng được), "example" (ví dụ minh hoạ nếu tài liệu có nêu, để trống nếu không có).${discNote} CHỈ trích xuất những gì THỰC SỰ có căn cứ trong tài liệu, KHÔNG tự bịa thêm mục không có trong nguồn.`,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    if (response.promptFeedback?.blockReason) {
      throw new Error(`Gemini chặn nội dung (safety filter): ${response.promptFeedback.blockReason}`);
    }

    const resultText = response.text;
    if (!resultText) {
      const reason = response.candidates?.[0]?.finishReason || 'unknown';
      throw new Error(`Gemini không trả về nội dung khi trích xuất kiến thức (finishReason: ${reason})`);
    }

    const parsed = JSON.parse(resultText) as ParsedKnowledgeEntry[];
    return parsed.filter((e) => e.name?.trim() && e.description?.trim());
  }, 'knowledgeImportService.extractEntriesFromText');
}

function normalizeColumnKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt để so khớp tên cột linh hoạt
    .replace(/\s+/g, '')
    .trim();
}

const NAME_KEYS = ['name', 'ten', 'tieude', 'title'];
const DESCRIPTION_KEYS = ['description', 'mota', 'congthuc', 'noidung'];
const EXAMPLE_KEYS = ['example', 'vidu', 'vidumauhoa'];
const DISC_KEYS = ['disccode', 'madisc', 'disc', 'loaidisc'];

function pickField(row: Record<string, unknown>, keys: string[]): string | undefined {
  const normalized: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    normalized[normalizeColumnKey(rawKey)] = value;
  }
  for (const key of keys) {
    const value = normalized[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

function parseStructuredSpreadsheet(storeType: KnowledgeStoreType, buffer: Buffer): ParsedKnowledgeEntry[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const entries: ParsedKnowledgeEntry[] = [];
  for (const row of rows) {
    const name = pickField(row, NAME_KEYS);
    const description = pickField(row, DESCRIPTION_KEYS);
    // Bỏ qua dòng thiếu field bắt buộc thay vì throw cả file lỗi - 1 dòng
    // trống/lỗi (VD dòng ngăn cách) không nên chặn import các dòng còn lại.
    if (!name || !description) continue;

    const entry: ParsedKnowledgeEntry = { name, description };
    const example = pickField(row, EXAMPLE_KEYS);
    if (example) entry.example = example;

    if (storeType === 'disc') {
      const discRaw = pickField(row, DISC_KEYS)?.toUpperCase();
      if (discRaw === 'D' || discRaw === 'I' || discRaw === 'S' || discRaw === 'C') {
        entry.discCode = discRaw;
      }
    }
    entries.push(entry);
  }
  return entries;
}

async function extractRawTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function parseKnowledgeFile(params: {
  storeType: KnowledgeStoreType;
  filename: string;
  buffer: Buffer;
}): Promise<ParsedKnowledgeEntry[]> {
  const ext = params.filename.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
    return parseStructuredSpreadsheet(params.storeType, params.buffer);
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer: params.buffer });
    return extractEntriesFromText(params.storeType, result.value);
  }

  if (ext === 'pdf') {
    const text = await extractRawTextFromPdf(params.buffer);
    return extractEntriesFromText(params.storeType, text);
  }

  if (ext === 'txt') {
    return extractEntriesFromText(params.storeType, params.buffer.toString('utf-8'));
  }

  throw new Error(`Định dạng file ".${ext}" không được hỗ trợ - chỉ nhận .docx, .pdf, .xlsx, .xls, .csv, .txt`);
}
