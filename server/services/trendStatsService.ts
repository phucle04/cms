import KnowledgeEntry, { DiscCode } from '../models/KnowledgeEntry';
import type { ITrendVideo } from '../models/TrendVideo';
import type { IResearchJobCombo, IResearchJobTrendStats, IResearchJobTrendStatEntry } from '../models/ResearchJob';

/**
 * Giai đoạn 6 Phase 3: tổng hợp xu hướng (hook/pain point/DISC nào đang gặp
 * nhiều nhất) từ các video VỪA phân tích xong trong 1 job, rồi gợi ý sẵn 1 bộ
 * combo (hook, pain point, DISC) cho từng kịch bản cần sinh - người dùng xem
 * lại/chỉnh tay ở bước "awaiting_combo_selection" trước khi Stage 5 chạy.
 */

const TOP_N_DISPLAY = 5;

interface RawKnowledgeMatch {
  hookEntryId: string | null;
  painPointEntryId: string | null;
  discCode: DiscCode | null;
}

// video.analysis.knowledgeMatch được resolveKnowledgeMatch() (Phase 2) ghi
// đè lại thành shape ĐÃ RESOLVE {hookEntryId, painPointEntryId, discCode} -
// KHÁC shape thô Gemini trả về (hookNewName...) - xem researchPipelineService.ts.
function extractResolvedMatch(video: ITrendVideo): RawKnowledgeMatch | null {
  const analysis = video.analysis as { knowledgeMatch?: unknown } | undefined;
  const match = analysis?.knowledgeMatch as Partial<RawKnowledgeMatch> | undefined;
  if (!match) return null;
  return {
    hookEntryId: match.hookEntryId ?? null,
    painPointEntryId: match.painPointEntryId ?? null,
    discCode: match.discCode ?? null,
  };
}

export async function computeTrendStats(videos: ITrendVideo[]): Promise<IResearchJobTrendStats> {
  const hookCounts = new Map<string, number>();
  const painPointCounts = new Map<string, number>();
  const discCounts: Record<DiscCode, number> = { D: 0, I: 0, S: 0, C: 0 };
  let videosClassified = 0;

  for (const video of videos) {
    const match = extractResolvedMatch(video);
    if (!match) continue;
    videosClassified += 1;
    if (match.hookEntryId) hookCounts.set(match.hookEntryId, (hookCounts.get(match.hookEntryId) ?? 0) + 1);
    if (match.painPointEntryId) {
      painPointCounts.set(match.painPointEntryId, (painPointCounts.get(match.painPointEntryId) ?? 0) + 1);
    }
    if (match.discCode) discCounts[match.discCode] += 1;
  }

  const idsToLookup = [...new Set([...hookCounts.keys(), ...painPointCounts.keys()])];
  const entries = idsToLookup.length > 0 ? await KnowledgeEntry.find({ _id: { $in: idsToLookup } }) : [];
  const nameById = new Map(entries.map((e) => [e.id, e.name]));

  const toSortedList = (counts: Map<string, number>): IResearchJobTrendStatEntry[] =>
    [...counts.entries()]
      .map(([entryId, count]) => ({ entryId, name: nameById.get(entryId) ?? '(entry đã bị xoá)', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N_DISPLAY);

  const discTotal = discCounts.D + discCounts.I + discCounts.S + discCounts.C;
  const discDistribution =
    discTotal > 0
      ? {
          D: Math.round((discCounts.D / discTotal) * 100),
          I: Math.round((discCounts.I / discTotal) * 100),
          S: Math.round((discCounts.S / discTotal) * 100),
          C: Math.round((discCounts.C / discTotal) * 100),
        }
      : { D: 0, I: 0, S: 0, C: 0 };

  return {
    topHooks: toSortedList(hookCounts),
    topPainPoints: toSortedList(painPointCounts),
    discDistribution,
    videosClassified,
  };
}

/**
 * Phân bổ scriptCount slot DISC theo tỉ lệ % xu hướng, dùng phương pháp "số dư
 * lớn nhất" (largest remainder method) - làm tròn xuống trước, rồi gán phần dư
 * cho code có phần thập phân lớn nhất, để tổng LUÔN khớp đúng scriptCount
 * (không như làm tròn từng số riêng lẻ có thể lệch tổng).
 */
function buildDiscOrder(distributionPct: Record<DiscCode, number>, scriptCount: number): (DiscCode | null)[] {
  const codes: DiscCode[] = ['D', 'I', 'S', 'C'];
  const totalPct = codes.reduce((sum, c) => sum + distributionPct[c], 0);
  if (totalPct <= 0 || scriptCount <= 0) {
    return Array(Math.max(scriptCount, 0)).fill(null);
  }

  const raw = codes.map((c) => (distributionPct[c] / totalPct) * scriptCount);
  const counts = raw.map((n) => Math.floor(n));
  let assigned = counts.reduce((a, b) => a + b, 0);

  const byRemainderDesc = codes
    .map((c, i) => ({ index: i, remainder: raw[i] - counts[i] }))
    .sort((a, b) => b.remainder - a.remainder);

  let i = 0;
  while (assigned < scriptCount && i < byRemainderDesc.length) {
    counts[byRemainderDesc[i].index] += 1;
    assigned += 1;
    i += 1;
  }

  const order: DiscCode[] = [];
  codes.forEach((c, idx) => {
    for (let k = 0; k < counts[idx]; k++) order.push(c);
  });
  return order.slice(0, scriptCount);
}

export function buildSuggestedCombos(stats: IResearchJobTrendStats, scriptCount: number): IResearchJobCombo[] {
  const discOrder = buildDiscOrder(stats.discDistribution, scriptCount);

  return Array.from({ length: scriptCount }, (_, i) => ({
    hookEntryId: stats.topHooks.length > 0 ? stats.topHooks[i % stats.topHooks.length].entryId : null,
    painPointEntryId: stats.topPainPoints.length > 0 ? stats.topPainPoints[i % stats.topPainPoints.length].entryId : null,
    discCode: discOrder[i] ?? null,
  }));
}
