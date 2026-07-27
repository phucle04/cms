import { EventEmitter } from 'events';
import type { PipelineEvent } from '../services/researchPipelineService';

/**
 * Cầu nối giữa pipeline (chạy nền, không gắn với 1 request cụ thể) và các
 * client SSE đang lắng nghe tiến độ của 1 jobId. Chỉ dùng in-memory
 * EventEmitter vì Express hiện chạy 1 instance duy nhất - nếu sau này scale
 * nhiều instance (nhiều process/container) thì bus này KHÔNG còn đủ (event
 * publish ở instance A sẽ không tới được client đang connect SSE ở instance
 * B), lúc đó cần thay bằng hàng đợi có pub/sub qua nhiều tiến trình như
 * BullMQ (Redis) hoặc MongoDB change streams. Việc đó nằm ngoài phạm vi hiện tại.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0); // nhiều job + nhiều tab cùng lúc là bình thường

export type JobEventListener = (event: PipelineEvent, payload: Record<string, unknown>) => void;

export function publishJobEvent(jobId: string, event: PipelineEvent, payload: Record<string, unknown>): void {
  emitter.emit(jobId, event, payload);
}

export function subscribeJobEvents(jobId: string, listener: JobEventListener): () => void {
  emitter.on(jobId, listener);
  return () => emitter.off(jobId, listener);
}
