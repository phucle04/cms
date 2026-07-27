import express from 'express';
import { optionalAuth } from '../middleware/auth';
import * as ideaController from '../controllers/ideaController';
import * as productController from '../controllers/productController';
import * as researchController from '../controllers/researchController';
import * as brandProfileController from '../controllers/brandProfileController';
import * as promptTemplateController from '../controllers/promptTemplateController';

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

// Research routes
router.post('/research/run', researchController.runTrendResearch);

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