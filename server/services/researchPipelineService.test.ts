import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import ResearchJob from '../models/ResearchJob';
import TrendVideo from '../models/TrendVideo';
import PromptTemplate from '../models/PromptTemplate';
import { TikTokService } from '../services/tiktokService';
import {
  runStage1GenerateHashtags,
  runStage2Scraping,
  runStage4Analyzing,
  addGeminiUsage,
  recomputeTotalCost,
  MIN_VIDEOS_WITH_ANALYSIS,
  stageIndexForStatus,
  PipelineCancelledError,
  type EmitFn,
} from './researchPipelineService';
import { HashtagSuggestionsSchema, GeneratedScriptsSchema } from '../types/pipeline';
import type { analyzeVideo, analyzeFromTextOnly } from './geminiVideoService';
import type { IResearchJob } from '../models/ResearchJob';
import type { ITrendVideo } from '../models/TrendVideo';

/**
 * Test researchPipelineService.ts bằng mock, KHÔNG gọi mạng/DB thật:
 * - Mongoose model static method (TrendVideo.find/countDocuments,
 *   PromptTemplate.findOne) mock được trực tiếp qua mock.method vì model là
 *   1 object dùng chung, không phải import binding riêng bản sao.
 * - TikTokService: mock qua prototype (áp dụng cho mọi instance kể cả
 *   `new TikTokService()` tạo bên trong service).
 * - analyzeVideo/analyzeFromTextOnly (hàm PLAIN export từ geminiVideoService.ts,
 *   không phải model/class): dùng tham số `deps` injectable của
 *   runStage4Analyzing (xem Stage4Deps trong researchPipelineService.ts) -
 *   ĐÃ THỬ mock qua require()/import * as và không ổn định (undefined ngẫu
 *   nhiên tuỳ thứ tự nạp module khi chạy cùng lúc với import ESM của chính
 *   file này), nên chọn dependency injection - cùng pattern đã dùng thành
 *   công cho waitForFileActive() và downloadVideo() ở Giai đoạn 2.
 */

function makeFakeJob(overrides: Partial<IResearchJob> = {}): IResearchJob {
  const base = {
    _id: 'job-1',
    userId: 'user-1',
    productId: 'product-1',
    brandProfileId: undefined,
    status: 'queued',
    autoSelectTop3: true,
    suggestedHashtags: [],
    selectedHashtags: ['abc'],
    progress: [],
    resultIdeaIds: [],
    resultScriptIds: [],
    cost: {
      apifyEstimatedUsd: 0,
      apifyActualUsd: 0,
      geminiInputTokens: 0,
      geminiOutputTokens: 0,
      geminiEstimatedUsd: 0,
      totalEstimatedUsd: 0,
    },
    save: async () => {},
    ...overrides,
  };
  return base as unknown as IResearchJob;
}

function makeFakeVideo(overrides: Partial<ITrendVideo> = {}): ITrendVideo {
  const base = {
    videoId: 'v1',
    webVideoUrl: 'https://www.tiktok.com/@x/video/v1',
    caption: 'caption',
    hashtags: ['a'],
    playCount: 100,
    diggCount: 10,
    downloadStatus: 'text_only',
    topComments: [],
    subtitleLinks: [],
    analysis: undefined,
    analysisConfidence: undefined,
    analyzedAt: undefined,
    save: async () => {},
    ...overrides,
  };
  return base as unknown as ITrendVideo;
}

const noopEmit: EmitFn = () => {};

function fakeTrendVideoFindQuery(videos: ITrendVideo[]) {
  return { sort: () => Promise.resolve(videos) };
}

function fakePromptTemplateFindOneQuery(template: unknown) {
  return { sort: () => Promise.resolve(template) };
}

// checkCancelled() trong researchPipelineService.ts gọi ResearchJob.exists()
// thật ở đầu mỗi Stage - mock trả về null (chưa bị yêu cầu dừng) cho MỌI
// test không tự test tính năng dừng job, tránh lỗi "not connected" thật.
function mockNotCancelled() {
  return mock.method(ResearchJob, 'exists', async () => null);
}

// ============================================================
// addGeminiUsage / recomputeTotalCost - cộng dồn chi phí đúng qua nhiều lần gọi
// ============================================================

test('addGeminiUsage: cộng dồn token + chi phí đúng qua nhiều lần gọi', () => {
  const job = makeFakeJob();
  job.cost.apifyActualUsd = 0.05;

  addGeminiUsage(job, { model: 'gemini-3.6-flash', inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.003 });
  addGeminiUsage(job, { model: 'gemini-3.6-flash', inputTokens: 500, outputTokens: 100, estimatedUsd: 0.0015 });

  assert.equal(job.cost.geminiInputTokens, 1500);
  assert.equal(job.cost.geminiOutputTokens, 300);
  assert.equal(Math.round(job.cost.geminiEstimatedUsd * 10000) / 10000, 0.0045);
  // totalEstimatedUsd phải = apifyActualUsd (đã set thủ công) + geminiEstimatedUsd (cộng dồn)
  assert.equal(Math.round(job.cost.totalEstimatedUsd * 10000) / 10000, 0.0545);
});

test('recomputeTotalCost: cập nhật lại total khi apifyActualUsd đổi sau', () => {
  const job = makeFakeJob();
  job.cost.geminiEstimatedUsd = 0.01;
  job.cost.apifyActualUsd = 0.2;
  recomputeTotalCost(job);
  assert.equal(Math.round(job.cost.totalEstimatedUsd * 1000) / 1000, 0.21);
});

// ============================================================
// stageIndexForStatus - nền tảng của resume logic
// ============================================================

test('stageIndexForStatus: thứ tự đúng, status lạ (vd "failed") rơi về 0', () => {
  assert.equal(stageIndexForStatus('queued'), 0);
  assert.equal(stageIndexForStatus('generating_hashtags'), 1);
  assert.equal(stageIndexForStatus('scraping'), 2);
  assert.equal(stageIndexForStatus('downloading'), 3);
  assert.equal(stageIndexForStatus('analyzing'), 4);
  assert.equal(stageIndexForStatus('generating_scripts'), 5);
  assert.equal(stageIndexForStatus('failed'), 0);
  assert.equal(stageIndexForStatus('completed'), 0);
});

// ============================================================
// runStage2Scraping - resume bỏ qua nếu đã cào xong (KHÔNG gọi lại Apify)
// ============================================================

test('runStage2Scraping: resume MỨC 1 - đã có rawScrapedVideos thì KHÔNG gọi lại Apify', async () => {
  const rawVideos = [1, 2, 3, 4, 5].map((i) => ({
    id: `v${i}`,
    webVideoUrl: `https://www.tiktok.com/@x/video/v${i}`,
    text: `caption ${i}`,
    playCount: i * 100,
    hashtags: [],
  }));

  const searchSpy = mock.method(TikTokService.prototype, 'searchTrendVideosByHashtags', async () => {
    throw new Error('KHÔNG được gọi Apify khi đã có rawScrapedVideos lưu sẵn');
  });
  // Giả lập cả 5 video đã được lưu thành TrendVideo từ trước (resume MỨC 2
  // cũng phải bỏ qua, không gọi lại fetchTopComments).
  const existsSpy = mock.method(TrendVideo, 'exists', async () => true);
  const fetchCommentsSpy = mock.method(TikTokService.prototype, 'fetchTopComments', async () => {
    throw new Error('KHÔNG được gọi fetchTopComments cho video đã tồn tại (resume MỨC 2)');
  });
  const cancelSpy = mockNotCancelled();

  try {
    const job = makeFakeJob({ rawScrapedVideos: rawVideos as unknown as IResearchJob['rawScrapedVideos'] });
    let stageCompletePayload: Record<string, unknown> | undefined;
    const emit: EmitFn = (event, payload) => {
      if (event === 'stage_complete') stageCompletePayload = payload;
    };

    await runStage2Scraping(job, emit);

    assert.equal(searchSpy.mock.callCount(), 0);
    assert.equal(fetchCommentsSpy.mock.callCount(), 0);
    assert.equal(existsSpy.mock.callCount(), 5);
    assert.equal(stageCompletePayload?.videosCount, 5);
  } finally {
    searchSpy.mock.restore();
    existsSpy.mock.restore();
    fetchCommentsSpy.mock.restore();
    cancelSpy.mock.restore();
  }
});

// ============================================================
// runStage4Analyzing - ngưỡng fail <2 analysis, và KHÔNG fail khi 3/5 text_only
// nhưng vẫn đủ 2 phân tích thành công
// ============================================================

function fakeAnalysisResult() {
  return {
    analysis: {
      hook: { firstThreeSeconds: '', visualHook: '', spokenHook: '' },
      structure: [],
      production: { shotTypes: [], lighting: '', props: [], musicStyle: '', textOnScreen: [] },
      viralHypothesis: '',
      cta: '',
      transcript: '',
      analysisConfidence: 'low' as const,
    },
    usage: { model: 'test', inputTokens: 10, outputTokens: 5, estimatedUsd: 0.0001 },
  };
}

test('runStage4Analyzing: job FAIL khi < MIN_VIDEOS_WITH_ANALYSIS video phân tích thành công', async () => {
  const videos = Array.from({ length: 5 }, (_, i) => makeFakeVideo({ videoId: `v${i}` }));

  const findSpy = mock.method(TrendVideo, 'find', () => fakeTrendVideoFindQuery(videos));
  const templateSpy = mock.method(PromptTemplate, 'findOne', () =>
    fakePromptTemplateFindOneQuery({ systemPrompt: 'sys', userPromptTemplate: 'tpl', aiModel: '', temperature: 0.5 })
  );
  const cancelSpy = mockNotCancelled();

  let callIndex = 0;
  // Inject trực tiếp qua tham số deps của runStage4Analyzing (không mock
  // module/require - đã thử và không ổn định, xem ghi chú ở Stage4Deps).
  const analyzeFromTextOnlyFn = (async () => {
    callIndex += 1;
    // Chỉ video đầu tiên thành công, 4 video còn lại lỗi -> successCount=1 < 2.
    if (callIndex > 1) throw new Error('lỗi giả lập phân tích');
    return fakeAnalysisResult();
  }) as unknown as typeof analyzeFromTextOnly;

  try {
    const job = makeFakeJob();
    await assert.rejects(
      () =>
        runStage4Analyzing(job, noopEmit, {
          analyzeVideoFn: (async () => {
            throw new Error('KHÔNG nên gọi analyzeVideo - mọi video đều text_only');
          }) as unknown as typeof analyzeVideo,
          analyzeFromTextOnlyFn,
        }),
      /Chỉ có 1\/5 video phân tích thành công/
    );
  } finally {
    findSpy.mock.restore();
    templateSpy.mock.restore();
    cancelSpy.mock.restore();
  }
});

test('runStage4Analyzing: KHÔNG fail khi 3/5 video là text_only lỗi nhưng đủ 2 video phân tích thành công', async () => {
  const videos = Array.from({ length: 5 }, (_, i) => makeFakeVideo({ videoId: `v${i}` }));

  const findSpy = mock.method(TrendVideo, 'find', () => fakeTrendVideoFindQuery(videos));
  const templateSpy = mock.method(PromptTemplate, 'findOne', () =>
    fakePromptTemplateFindOneQuery({ systemPrompt: 'sys', userPromptTemplate: 'tpl', aiModel: '', temperature: 0.5 })
  );
  const cancelSpy = mockNotCancelled();

  let callIndex = 0;
  const analyzeFromTextOnlyFn = (async () => {
    callIndex += 1;
    // 2 video đầu thành công, 3 video sau lỗi -> successCount=2 == MIN_VIDEOS_WITH_ANALYSIS, KHÔNG fail.
    if (callIndex > 2) throw new Error('lỗi giả lập phân tích');
    return fakeAnalysisResult();
  }) as unknown as typeof analyzeFromTextOnly;

  try {
    assert.equal(MIN_VIDEOS_WITH_ANALYSIS, 2);
    const job = makeFakeJob();
    await runStage4Analyzing(job, noopEmit, {
      analyzeVideoFn: (async () => {
        throw new Error('KHÔNG nên gọi analyzeVideo - mọi video đều text_only');
      }) as unknown as typeof analyzeVideo,
      analyzeFromTextOnlyFn,
    }); // không throw
  } finally {
    findSpy.mock.restore();
    templateSpy.mock.restore();
    cancelSpy.mock.restore();
  }
});

// ============================================================
// Giai đoạn 5 (G6b) - bổ sung 3 ca xấu chưa có test trước đó:
// #1 Apify trả về 0 video, #4 Gemini trả JSON sai schema, #7 kill giữa
// Stage 4 rồi resume (không gọi lại đã phân tích xong).
// Các ca #3 (tải video fail -> text_only), #5 (429 liên tục), #6 (Mongo mất
// kết nối) đã có sẵn test tương ứng: videoDownloadService.test.ts ("cả 2
// tầng đều fail -> text_only"), geminiVideoService.test.ts (withGeminiRetry
// 429/503/hết retry), withDbRetry.test.ts (MongoNetworkError) - không lặp
// lại ở đây.
// ============================================================

test('runStage2Scraping (G6#1): Apify trả về 0 video -> throw lỗi rõ ràng, không crash', async () => {
  const searchSpy = mock.method(TikTokService.prototype, 'searchTrendVideosByHashtags', async () => ({
    videos: [],
    totalFetched: 0,
    apifyActualUsd: 0.02,
  }));
  const cancelSpy = mockNotCancelled();

  try {
    const job = makeFakeJob({ selectedHashtags: ['#khongtontai'] });
    await assert.rejects(() => runStage2Scraping(job, noopEmit), /Không tìm thấy video nào cho hashtag/);
    assert.equal(searchSpy.mock.callCount(), 1);
  } finally {
    searchSpy.mock.restore();
    cancelSpy.mock.restore();
  }
});

test('runStage4Analyzing (G6#7): resume - video đã analyzedAt từ trước KHÔNG gọi lại Gemini', async () => {
  const alreadyAnalyzedVideo = makeFakeVideo({
    videoId: 'v-done',
    analyzedAt: new Date(),
    analysisConfidence: 'high',
  });
  const pendingVideo = makeFakeVideo({ videoId: 'v-pending' });

  const findSpy = mock.method(TrendVideo, 'find', () => fakeTrendVideoFindQuery([alreadyAnalyzedVideo, pendingVideo]));
  const templateSpy = mock.method(PromptTemplate, 'findOne', () =>
    fakePromptTemplateFindOneQuery({ systemPrompt: 'sys', userPromptTemplate: 'tpl', aiModel: '', temperature: 0.5 })
  );
  const cancelSpy = mockNotCancelled();

  let analyzeFromTextOnlyCallCount = 0;
  const analyzeFromTextOnlyFn = (async () => {
    analyzeFromTextOnlyCallCount += 1;
    return fakeAnalysisResult();
  }) as unknown as typeof analyzeFromTextOnly;

  try {
    const job = makeFakeJob();
    await runStage4Analyzing(job, noopEmit, {
      analyzeVideoFn: (async () => {
        throw new Error('KHÔNG nên gọi analyzeVideo - cả 2 video đều text_only');
      }) as unknown as typeof analyzeVideo,
      analyzeFromTextOnlyFn,
    });

    // Chỉ video CHƯA analyzedAt mới được gọi phân tích - video đã xong (giả
    // lập kết quả của lần chạy trước khi process bị kill) phải được BỎ QUA,
    // không tốn thêm tiền Gemini khi resume.
    assert.equal(analyzeFromTextOnlyCallCount, 1);
  } finally {
    findSpy.mock.restore();
    templateSpy.mock.restore();
    cancelSpy.mock.restore();
  }
});

test('HashtagSuggestionsSchema (G6#4): Gemini trả JSON sai schema -> zod throw rõ ràng, không lọt qua', () => {
  // Thiếu field bắt buộc (reason, score) - mô phỏng Gemini trả JSON hợp lệ
  // cú pháp nhưng sai cấu trúc đã khai báo trong responseSchema.
  const malformed = [{ tag: '#test' }, { tag: '#test2', reason: 'ok', score: 999 }];
  assert.throws(() => HashtagSuggestionsSchema.parse(malformed));

  // JSON hợp lệ nhưng ít hơn 8 phần tử (schema yêu cầu .min(8).max(12))
  const tooFew = [{ tag: '#a', reason: 'r', score: 50 }];
  assert.throws(() => HashtagSuggestionsSchema.parse(tooFew));
});

// ============================================================
// Dừng job ở bất kỳ giai đoạn nào (yêu cầu người dùng sau Giai đoạn 5) -
// checkCancelled() đọc cancelRequested TRỰC TIẾP TỪ DB (ResearchJob.exists),
// không tin job.cancelRequested trong bộ nhớ vì request cancel chạy ở 1
// Express request KHÁC với request đang chạy pipeline nền.
// ============================================================

test('runStage1GenerateHashtags: cancelRequested=true -> throw PipelineCancelledError, KHÔNG gọi Gemini', async () => {
  const cancelSpy = mock.method(ResearchJob, 'exists', async () => true);

  try {
    const job = makeFakeJob();
    await assert.rejects(() => runStage1GenerateHashtags(job, noopEmit), (err: unknown) => {
      assert.ok(err instanceof PipelineCancelledError);
      return true;
    });
  } finally {
    cancelSpy.mock.restore();
  }
});

test('runStage2Scraping: cancelRequested=true giữa vòng lặp lưu video -> dừng, không lưu tiếp video còn lại', async () => {
  const rawVideos = [1, 2, 3].map((i) => ({
    id: `v${i}`,
    webVideoUrl: `https://www.tiktok.com/@x/video/v${i}`,
    text: `caption ${i}`,
    playCount: i * 100,
    hashtags: [],
  }));

  // Bản thân Stage 2 (đã có rawScrapedVideos, resume MỨC 1) không gọi lại
  // Apify - cancelRequested chỉ trở thành true SAU KHI video đầu tiên đã lưu
  // xong, mô phỏng người dùng bấm "Dừng" giữa lúc Stage 2 đang chạy.
  let existsCallCount = 0;
  const cancelSpy = mock.method(ResearchJob, 'exists', async () => {
    existsCallCount += 1;
    // Check #1 (đầu Stage) và #2 (video 1 trong loop): chưa cancel - video 1
    // được xử lý xong. Check #3 (video 2): đã cancel - dừng trước khi lưu
    // tiếp, mô phỏng người dùng bấm "Dừng" sau khi 1 video đã lưu xong.
    return existsCallCount > 2;
  });
  const trendVideoExistsSpy = mock.method(TrendVideo, 'exists', async () => false);
  let savedCount = 0;
  const findOneAndUpdateSpy = mock.method(TrendVideo, 'findOneAndUpdate', async () => {
    savedCount += 1;
    return {};
  });
  const fetchCommentsSpy = mock.method(TikTokService.prototype, 'fetchTopComments', async () => []);

  try {
    const job = makeFakeJob({ rawScrapedVideos: rawVideos as unknown as IResearchJob['rawScrapedVideos'] });
    await assert.rejects(() => runStage2Scraping(job, noopEmit), (err: unknown) => {
      assert.ok(err instanceof PipelineCancelledError);
      return true;
    });
    // Dừng lại giữa vòng lặp - đã lưu đúng 1/3 video trước khi bị dừng.
    assert.equal(savedCount, 1);
  } finally {
    cancelSpy.mock.restore();
    trendVideoExistsSpy.mock.restore();
    findOneAndUpdateSpy.mock.restore();
    fetchCommentsSpy.mock.restore();
  }
});

test('GeneratedScriptsSchema (G6#4): Gemini trả thiếu/sai số phần tử -> zod throw rõ ràng', () => {
  // Đúng cấu trúc từng phần tử nhưng chỉ có 3/5 kịch bản (schema yêu cầu đúng 5)
  const oneScript = {
    title: 't',
    angle: 'a',
    targetPainPoint: 'p',
    hook: 'h',
    body: [],
    cta: 'c',
    caption: 'cap',
    hashtags: [],
    shotList: [],
    learnedFrom: [],
    confidence: 'high' as const,
  };
  assert.throws(() => GeneratedScriptsSchema.parse([oneScript, oneScript, oneScript]));

  // Không phải JSON array hợp lệ theo schema (object rỗng)
  assert.throws(() => GeneratedScriptsSchema.parse({}));
});
