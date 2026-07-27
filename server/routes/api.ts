import express from 'express';
import { optionalAuth } from '../middleware/auth';
import * as ideaController from '../controllers/ideaController';
import * as productController from '../controllers/productController';
import * as researchController from '../controllers/researchController';
import * as researchJobController from '../controllers/researchJobController';
import * as brandProfileController from '../controllers/brandProfileController';
import * as promptTemplateController from '../controllers/promptTemplateController';
import * as scriptController from '../controllers/scriptController';
import { proxyImage } from '../controllers/proxyImageController';

const router = express.Router();

// TẠM DÙNG optionalAuth thay cho "protect" (chưa có trang login).
// Khi làm xong login, đổi lại thành: router.use(protect);
router.use(optionalAuth);

// Idea routes
router.get('/ideas', ideaController.getIdeas);
router.get('/ideas/:id', ideaController.getIdea);
router.post('/ideas', ideaController.createIdea);
router.put('/ideas/:id', ideaController.updateIdea);
router.delete('/ideas/:id', ideaController.deleteIdea);
router.post('/ideas/generate', ideaController.generateIdeasFromProduct);
router.post('/ideas/bulk-update', ideaController.bulkUpdateIdeas);

// Product routes
router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProduct);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// Research routes (legacy, giữ nguyên cho tương thích ngược)
router.post('/research/run', researchController.runTrendResearch);

// Research job routes (Giai đoạn 3 - pipeline 5 stage chạy nền + SSE)
router.post('/research/jobs', researchJobController.createResearchJob);
router.get('/research/jobs', researchJobController.listResearchJobs);
router.get('/research/jobs/:id', researchJobController.getResearchJob);
router.post('/research/jobs/:id/hashtags', researchJobController.selectHashtags);
router.post('/research/jobs/:id/retry', researchJobController.retryResearchJob);
router.get('/research/jobs/:id/stream', researchJobController.streamResearchJob);

// Proxy ảnh (chống hotlink-block từ TikTok CDN) - whitelist domain xem
// proxyImageController.ts::ALLOWED_HOST_SUFFIXES.
router.get('/proxy-image', proxyImage);

// Script routes (controller đã có sẵn từ trước, chỉ mới nối route ở đây để
// UI Giai đoạn 4 có thể "Đẩy sang Scripting" = đổi status script thật)
router.get('/scripts', scriptController.getScripts);
router.get('/scripts/:id', scriptController.getScript);
router.post('/scripts', scriptController.createScript);
router.put('/scripts/:id', scriptController.updateScript);
router.delete('/scripts/:id', scriptController.deleteScript);

// Brand profile routes
router.get('/brand-profiles', brandProfileController.getBrandProfiles);
router.get('/brand-profiles/:id', brandProfileController.getBrandProfile);
router.post('/brand-profiles', brandProfileController.createBrandProfile);
router.put('/brand-profiles/:id', brandProfileController.updateBrandProfile);
router.delete('/brand-profiles/:id', brandProfileController.deleteBrandProfile);

// Prompt template routes
router.get('/prompt-templates', promptTemplateController.getPromptTemplates);
router.get('/prompt-templates/:id', promptTemplateController.getPromptTemplate);
router.post('/prompt-templates', promptTemplateController.createPromptTemplate);
router.put('/prompt-templates/:id', promptTemplateController.updatePromptTemplate);
router.delete('/prompt-templates/:id', promptTemplateController.deletePromptTemplate);
router.post('/prompt-templates/:id/reset-default', promptTemplateController.resetPromptTemplateToDefault);

export default router;