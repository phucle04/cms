import express from 'express';
import { optionalAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ideaController from '../controllers/ideaController';
import * as productController from '../controllers/productController';
import * as researchJobController from '../controllers/researchJobController';
import * as brandProfileController from '../controllers/brandProfileController';
import * as promptTemplateController from '../controllers/promptTemplateController';
import * as scriptController from '../controllers/scriptController';
import { proxyImage } from '../controllers/proxyImageController';
import * as knowledgeController from '../controllers/knowledgeController';
import * as videoKpiController from '../controllers/videoKpiController';
import * as valueCommentController from '../controllers/valueCommentController';
import {
  createProductSchema,
  updateProductSchema,
  createIdeaSchema,
  updateIdeaSchema,
  bulkUpdateIdeasSchema,
  bulkUpdateScriptsSchema,
  createResearchJobSchema,
  selectHashtagsSchema,
  selectCombosSchema,
  createKnowledgeEntrySchema,
  updateKnowledgeEntrySchema,
  createVideoKpiSchema,
} from '../validation/schemas';

const router = express.Router();

// TẠM DÙNG optionalAuth thay cho "protect" (chưa có trang login).
// Khi làm xong login, đổi lại thành: router.use(protect);
router.use(optionalAuth);

// Idea routes
router.get('/ideas', ideaController.getIdeas);
router.get('/ideas/:id', ideaController.getIdea);
router.post('/ideas', validateBody(createIdeaSchema), ideaController.createIdea);
router.put('/ideas/:id', validateBody(updateIdeaSchema), ideaController.updateIdea);
router.delete('/ideas/:id', ideaController.deleteIdea);
router.post('/ideas/generate', ideaController.generateIdeasFromProduct);
router.post('/ideas/bulk-update', validateBody(bulkUpdateIdeasSchema), ideaController.bulkUpdateIdeas);

// Product routes
router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProduct);
router.post('/products', validateBody(createProductSchema), productController.createProduct);
router.put('/products/:id', validateBody(updateProductSchema), productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// Research job routes (Giai đoạn 3 - pipeline 5 stage chạy nền + SSE)
router.get('/research/estimate-cost', researchJobController.getResearchJobCostEstimate);
router.post('/research/jobs', validateBody(createResearchJobSchema), researchJobController.createResearchJob);
router.get('/research/jobs', researchJobController.listResearchJobs);
router.get('/research/jobs/:id', researchJobController.getResearchJob);
router.post('/research/jobs/:id/hashtags', validateBody(selectHashtagsSchema), researchJobController.selectHashtags);
router.post('/research/jobs/:id/combos', validateBody(selectCombosSchema), researchJobController.selectCombos);
router.post('/research/jobs/:id/retry', researchJobController.retryResearchJob);
router.post('/research/jobs/:id/cancel', researchJobController.cancelResearchJob);
router.get('/research/jobs/:id/stream', researchJobController.streamResearchJob);

// Proxy ảnh (chống hotlink-block từ TikTok CDN) - whitelist domain xem
// proxyImageController.ts::ALLOWED_HOST_SUFFIXES.
router.get('/proxy-image', proxyImage);

// Script routes (controller đã có sẵn từ trước, chỉ mới nối route ở đây để
// UI Giai đoạn 4 có thể "Đẩy sang Scripting" = đổi status script thật)
router.get('/scripts', scriptController.getScripts);
router.get('/scripts/:id', scriptController.getScript);
router.post('/scripts', scriptController.createScript);
router.post('/scripts/bulk-update', validateBody(bulkUpdateScriptsSchema), scriptController.bulkUpdateScripts);
router.put('/scripts/:id', scriptController.updateScript);
router.delete('/scripts/:id', scriptController.deleteScript);

// Brand profile routes
router.get('/brand-profiles', brandProfileController.getBrandProfiles);
router.get('/brand-profiles/:id', brandProfileController.getBrandProfile);
router.post('/brand-profiles', brandProfileController.createBrandProfile);
router.put('/brand-profiles/:id', brandProfileController.updateBrandProfile);
router.delete('/brand-profiles/:id', brandProfileController.deleteBrandProfile);

// Knowledge base routes (kho hook / pain point / DISC - Giai đoạn 6)
router.get('/knowledge', knowledgeController.getKnowledgeEntries);
router.post('/knowledge', validateBody(createKnowledgeEntrySchema), knowledgeController.createKnowledgeEntry);
router.put('/knowledge/:id', validateBody(updateKnowledgeEntrySchema), knowledgeController.updateKnowledgeEntry);
router.delete('/knowledge/:id', knowledgeController.deleteKnowledgeEntry);
// multipart/form-data (multer) - KHÔNG dùng validateBody (chỉ hiểu JSON),
// storeType được tự kiểm tra trong controller sau khi multer parse xong.
router.post(
  '/knowledge/import',
  knowledgeController.uploadKnowledgeFileMiddleware,
  knowledgeController.importKnowledgeFile
);

// Video KPI routes (nhật ký video đã đăng thật - Giai đoạn 6 Phase 5, đóng
// vòng phản hồi cho usageCount trong kho kiến thức)
router.get('/video-kpis', videoKpiController.listVideoKpis);
router.post('/video-kpis', validateBody(createVideoKpiSchema), videoKpiController.createVideoKpi);
router.delete('/video-kpis/:id', videoKpiController.deleteVideoKpi);

// Value comment routes (kho bình luận tái dùng, AI tự lưu - Giai đoạn 6 Phase 6)
router.get('/value-comments', valueCommentController.listValueComments);
router.delete('/value-comments/:id', valueCommentController.deleteValueComment);

// Prompt template routes
router.get('/prompt-templates', promptTemplateController.getPromptTemplates);
router.get('/prompt-templates/:id', promptTemplateController.getPromptTemplate);
router.post('/prompt-templates', promptTemplateController.createPromptTemplate);
router.put('/prompt-templates/:id', promptTemplateController.updatePromptTemplate);
router.delete('/prompt-templates/:id', promptTemplateController.deletePromptTemplate);
router.post('/prompt-templates/:id/reset-default', promptTemplateController.resetPromptTemplateToDefault);

export default router;