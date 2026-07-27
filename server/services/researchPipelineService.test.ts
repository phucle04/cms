import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import TrendVideo from '../models/TrendVideo';
import PromptTemplate from '../models/PromptTemplate';
import { TikTokService } from '../services/tiktokService';
import {
  runStage2Scraping,
  runStage4Analyzing,
  addGeminiUsage,
  recomputeTotalCost,
  MIN_VIDEOS_WITH_ANALYSIS,
  stageIndexForStatus,
  type EmitFn,
} from './researchPipelineService';
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

test('runStage2Scraping: resume - đã có TrendVideo cho job thì KHÔNG gọi lại Apify', async () => {
  const countSpy = mock.method(TrendVideo, 'countDocuments', async () => 5);
  const searchSpy = mock.method(TikTokService.prototype, 'searchTrendVideosByHashtags', async () => {
    throw new Error('KHÔNG được gọi Apify khi đã resume và có sẵn video');
  });

  try {
    const job = makeFakeJob();
    let stageCompletePayload: Record<string, unknown> | undefined;
    const emit: EmitFn = (event, payload) => {
      if (event === 'stage_complete') stageCompletePayload = payload;
    };

    await runStage2Scraping(job, emit);

    assert.equal(countSpy.mock.callCount(), 1);
    assert.equal(searchSpy.mock.callCount(), 0);
    assert.equal(stageCompletePayload?.videosCount, 5);
    assert.equal(stageCompletePayload?.apifyActualUsd, 0);
  } finally {
    countSpy.mock.restore();
    searchSpy.mock.restore();
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
  }
});

test('runStage4Analyzing: KHÔNG fail khi 3/5 video là text_only lỗi nhưng đủ 2 video phân tích thành công', async () => {
  const videos = Array.from({ length: 5 }, (_, i) => makeFakeVideo({ videoId: `v${i}` }));

  const findSpy = mock.method(TrendVideo, 'find', () => fakeTrendVideoFindQuery(videos));
  const templateSpy = mock.method(PromptTemplate, 'findOne', () =>
    fakePromptTemplateFindOneQuery({ systemPrompt: 'sys', userPromptTemplate: 'tpl', aiModel: '', temperature: 0.5 })
  );

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
  }
});
