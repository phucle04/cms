import mongoose from 'mongoose';

/**
 * Retry cho thao tác GHI DB khi gặp lỗi kết nối TẠM THỜI - sự cố thật
 * (2026-07-27): 1 job tốn ~$0.26 Apify+Gemini chết giữa chừng chỉ vì mạng
 * chớp lúc gọi job.save(). KHÔNG retry lỗi logic (validation, duplicate key,
 * cast error...) vì retry sẽ không giúp gì và có thể che mất lỗi thật.
 *
 * Dùng `mongoose.mongo.*` (namespace driver mongoose re-export) thay vì
 * import trực tiếp package `mongodb`, vì `mongodb` không phải dependency
 * trực tiếp của project này (nằm trong node_modules/mongoose/node_modules,
 * import thẳng sẽ lỗi MODULE_NOT_FOUND) - đã verify thật qua node -e trước
 * khi viết, không đoán.
 */

const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000];

function isTransientDbError(error: unknown): boolean {
  if (error instanceof mongoose.mongo.MongoNetworkError) return true;
  if (error instanceof mongoose.mongo.MongoServerSelectionError) return true;

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND') return true;

    // MongoServerSelectionError thường bọc lỗi DNS/network gốc trong message,
    // kiểm tra thêm chuỗi để bắt các trường hợp không đi qua đúng class trên.
    if (/ETIMEDOUT|ECONNRESET|ENOTFOUND|topology was destroyed|server selection timed out/i.test(error.message)) {
      return true;
    }
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bọc 1 thao tác ghi DB (job.save(), Model.create(), Model.findOneAndUpdate()...)
 * để tự retry khi gặp lỗi kết nối tạm thời. Lỗi logic (validation, duplicate
 * key, cast...) throw NGAY, không retry.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isTransientDbError(error)) {
        throw error;
      }

      if (attempt >= RETRY_DELAYS_MS.length) {
        break;
      }

      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(
        `[withDbRetry] ${label}: lỗi kết nối tạm thời (lần ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}), ` +
          `chờ ${delay}ms rồi thử lại - ${error instanceof Error ? error.message : error}`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
