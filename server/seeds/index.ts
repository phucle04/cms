import connectDB from '../config/database';
import User from '../models/User';
import ProductBrief from '../models/ProductBrief';
import Idea from '../models/Idea';
import Trend from '../models/Trend';
import VideoKPI from '../models/VideoKPI';
import BrandProfile from '../models/BrandProfile';
import PromptTemplate from '../models/PromptTemplate';
import KnowledgeEntry from '../models/KnowledgeEntry';
import { DEMO_USER_ID } from '../middleware/auth';
import { defaultBrandProfile } from './defaults/brandProfile.default';
import { defaultPromptTemplates } from './defaults/promptTemplates.default';
import { defaultKnowledgeEntries } from './defaults/knowledgeEntries.default';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Seed IDEMPOTENT (upsert, không deleteMany) cho BrandProfile + PromptTemplate.
 * Dùng DEMO_USER_ID cố định (không phải user._id ngẫu nhiên tạo ở
 * seedDatabase() bên dưới) vì toàn bộ hệ thống hiện tra cứu dữ liệu qua
 * optionalAuth -> req.userId = DEMO_USER_ID khi chưa có JWT thật (xem
 * server/middleware/auth.ts). Nếu seed vào user._id ngẫu nhiên, dữ liệu sẽ
 * không bao giờ xuất hiện qua API. Chạy lại hàm này nhiều lần chỉ cập nhật
 * đúng 1 bản ghi cho mỗi key, không tạo bản ghi trùng.
 */
const seedDefaults = async () => {
  const brandProfile = await BrandProfile.findOneAndUpdate(
    { userId: DEMO_USER_ID, brandName: defaultBrandProfile.brandName },
    { $set: { ...defaultBrandProfile, userId: DEMO_USER_ID } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Upserted default BrandProfile: ${brandProfile.brandName} (${brandProfile._id})`);

  for (const def of defaultPromptTemplates) {
    const template = await PromptTemplate.findOneAndUpdate(
      { userId: DEMO_USER_ID, key: def.key, isSystemSeed: true },
      { $set: { ...def, userId: DEMO_USER_ID, isSystemSeed: true, isDefault: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Upserted default PromptTemplate: ${template.key} (${template._id})`);
  }

  // 4 entry DISC nền tảng (D/I/S/C) - match theo discCode để idempotent,
  // KHÔNG động vào usageCount/status nếu bản ghi đã tồn tại (người dùng có
  // thể đã sửa nội dung/duyệt entry khác trong lúc dùng thật).
  for (const def of defaultKnowledgeEntries) {
    const entry = await KnowledgeEntry.findOneAndUpdate(
      { userId: DEMO_USER_ID, storeType: def.storeType, discCode: def.discCode },
      { $setOnInsert: { ...def, userId: DEMO_USER_ID, source: 'uploaded', status: 'approved', usageCount: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Upserted default KnowledgeEntry: ${entry.name} (${entry._id})`);
  }
};

/**
 * BUG THẬT (đã gây mất dữ liệu): trước đây `npm run seed` LUÔN xoá sạch
 * User/ProductBrief/Idea/Trend/VideoKPI rồi tạo lại data demo (Coffee Maker,
 * Fitness Tracker...) - nhưng đây cũng là lệnh duy nhất để cập nhật
 * BrandProfile/PromptTemplate/KnowledgeEntry mặc định mỗi khi code default
 * thay đổi (xem seedDefaults() ở trên). Người dùng chạy "npm run seed" tưởng
 * chỉ để đồng bộ prompt template mặc định, nhưng vô tình xoá sạch sản
 * phẩm/ý tưởng THẬT đang dùng. Giờ tách hẳn: "npm run seed" (mặc định) CHỈ
 * chạy seedDefaults() - an toàn, idempotent, không đụng dữ liệu thật. Phần
 * demo data (xoá + tạo lại) CHỈ chạy khi gọi RÕ RÀNG "npm run seed:demo"
 * (truyền cờ --with-demo-data).
 */
const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    const withDemoData = process.argv.includes('--with-demo-data');

    if (!withDemoData) {
      console.log(
        'Bỏ qua phần data demo (Coffee Maker/Fitness Tracker/Trend/KPI mẫu) - chỉ đồng bộ ' +
          'BrandProfile/PromptTemplate/KnowledgeEntry mặc định, KHÔNG đụng tới sản phẩm/ý tưởng thật. ' +
          'Chạy "npm run seed:demo" nếu thật sự muốn tạo lại data demo (sẽ XOÁ SẠCH ProductBrief/Idea/Trend/VideoKPI hiện có).'
      );
      await seedDefaults();
      console.log('Đồng bộ default hoàn tất!');
      process.exit(0);
    }

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      ProductBrief.deleteMany({}),
      Idea.deleteMany({}),
      Trend.deleteMany({}),
      VideoKPI.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create test user - _id CỐ ĐỊNH = DEMO_USER_ID (không để Mongo tự sinh
    // ngẫu nhiên), vì optionalAuth luôn gán req.userId = DEMO_USER_ID khi
    // chưa có JWT thật. Nếu để _id ngẫu nhiên, mọi Product/Idea/Trend/KPI bên
    // dưới sẽ không bao giờ đọc được qua API (đây chính là nguyên nhân dữ
    // liệu "mồ côi" đã phát hiện ở Giai đoạn 1).
    const user = await User.create({
      _id: DEMO_USER_ID,
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'admin',
      settings: {
        aiProvider: 'mock',
        aiApiKey: '',
        aiModel: 'gpt-4',
      },
    });
    console.log('Created test user:', user.email);

    // Create sample products
    const products = await ProductBrief.insertMany([
      {
        userId: user._id,
        name: 'Premium Coffee Maker',
        category: 'Electronics',
        usp: 'Brews perfect coffee in 30 seconds',
        painPoints: 'Morning rush, waiting for coffee',
        keywords: ['coffee', 'maker', 'fast', 'home'],
        status: 'active',
      },
      {
        userId: user._id,
        name: 'Fitness Tracker Band',
        category: 'Wearables',
        usp: '7-day battery life with AI health insights',
        painPoints: 'Health tracking, battery anxiety',
        keywords: ['fitness', 'tracker', 'health', 'battery'],
        status: 'active',
      },
    ]);
    console.log('Created sample products:', products.length);

    // Create sample ideas
    const ideas = await Idea.insertMany([
      {
        userId: user._id,
        title: 'Morning routine transformation',
        description: 'Show how the coffee maker fits into a perfect morning',
        source: 'trend',
        priority: 'high',
        productId: products[0]._id,
        status: 'new',
      },
      {
        userId: user._id,
        title: 'Fitness journey before/after',
        description: 'User transformation story with fitness tracker data',
        source: 'user',
        priority: 'medium',
        productId: products[1]._id,
        status: 'new',
      },
    ]);
    console.log('Created sample ideas:', ideas.length);

    // Create sample trends
    await Trend.insertMany([
      {
        userId: user._id,
        name: 'Self-care mornings',
        description: 'Growing trend of wellness routines in morning',
        status: 'hot',
        source: 'TikTok',
        relevance: 'high',
        opportunities: ['Coffee culture', 'Wellness content'],
      },
      {
        userId: user._id,
        name: 'Fitness documentation',
        description: 'People sharing their fitness journey progress',
        status: 'hot',
        source: 'Instagram',
        relevance: 'high',
        opportunities: ['Before/after', 'Challenge series'],
      },
    ]);
    console.log('Created sample trends');

    // Create sample KPIs
    const kpis = await VideoKPI.insertMany([
      {
        userId: user._id,
        videoUrl: 'https://www.tiktok.com/@demo/video/1234567890',
        views: 125000,
        likes: 3450,
        comments: 890,
        retentionRate: 68,
        completionRate: 41,
        postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        userId: user._id,
        videoUrl: 'https://www.tiktok.com/@demo/video/1234567891',
        views: 45000,
        likes: 980,
        comments: 220,
        retentionRate: 52,
        completionRate: 28,
        postedAt: new Date(),
      },
    ]);
    console.log('Created sample KPIs:', kpis.length);

    // Seed idempotent (upsert theo userId+key) - an toàn khi chạy nhiều lần,
    // khác với phần demo data phía trên vốn xoá-và-tạo-lại mỗi lần chạy.
    await seedDefaults();

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
