import connectDB from '../config/database';
import { DEMO_USER_ID } from '../middleware/auth';
import dotenv from 'dotenv';

import ProductBrief from '../models/ProductBrief';
import Idea from '../models/Idea';
import Script from '../models/Script';
import Trend from '../models/Trend';
import Competitor from '../models/Competitor';
import ArchiveItem from '../models/ArchiveItem';
import AudioGuide from '../models/AudioGuide';
import BrandVoice from '../models/BrandVoice';
import Compliance from '../models/Compliance';
import Keywords from '../models/Keywords';
import Lesson from '../models/Lesson';
import Persona from '../models/Persona';
import StoreInfo from '../models/StoreInfo';
import Storyboard from '../models/Storyboard';
import ThumbnailBrief from '../models/ThumbnailBrief';
import VideoKPI from '../models/VideoKPI';
import VideoMetadata from '../models/VideoMetadata';
import WinLossAnalysis from '../models/WinLossAnalysis';
import BrandProfile from '../models/BrandProfile';
import PromptTemplate from '../models/PromptTemplate';
import ResearchJob from '../models/ResearchJob';
import TrendVideo from '../models/TrendVideo';

dotenv.config();

/**
 * Dọn dữ liệu "mồ côi": mọi document có userId KHÁC DEMO_USER_ID (ví dụ do
 * server/seeds/index.ts bản cũ tạo User với _id ngẫu nhiên trước khi được sửa
 * ở Giai đoạn 1.5) được gán lại userId = DEMO_USER_ID, vì optionalAuth luôn
 * tra cứu dữ liệu bằng DEMO_USER_ID khi chưa có JWT thật (server/middleware/auth.ts).
 * Không có DEMO_USER_ID thì dữ liệu tồn tại trong DB nhưng không API nào đọc được.
 *
 * MẶC ĐỊNH LÀ DRY-RUN (chỉ đếm, KHÔNG ghi). Phải truyền --apply mới ghi thật:
 *   npm run seed:fix-orphans              # xem trước, an toàn
 *   npm run seed:fix-orphans -- --apply   # ghi thật vào DB
 */

const MODELS: Array<{ name: string; model: { countDocuments: Function; updateMany: Function } }> = [
  { name: 'ProductBrief', model: ProductBrief },
  { name: 'Idea', model: Idea },
  { name: 'Script', model: Script },
  { name: 'Trend', model: Trend },
  { name: 'Competitor', model: Competitor },
  { name: 'ArchiveItem', model: ArchiveItem },
  { name: 'AudioGuide', model: AudioGuide },
  { name: 'BrandVoice', model: BrandVoice },
  { name: 'Compliance', model: Compliance },
  { name: 'Keywords', model: Keywords },
  { name: 'Lesson', model: Lesson },
  { name: 'Persona', model: Persona },
  { name: 'StoreInfo', model: StoreInfo },
  { name: 'Storyboard', model: Storyboard },
  { name: 'ThumbnailBrief', model: ThumbnailBrief },
  { name: 'VideoKPI', model: VideoKPI },
  { name: 'VideoMetadata', model: VideoMetadata },
  { name: 'WinLossAnalysis', model: WinLossAnalysis },
  { name: 'BrandProfile', model: BrandProfile },
  { name: 'PromptTemplate', model: PromptTemplate },
  { name: 'ResearchJob', model: ResearchJob },
  { name: 'TrendVideo', model: TrendVideo },
];

const run = async () => {
  const apply = process.argv.includes('--apply');

  await connectDB();
  console.log(`Mode: ${apply ? 'APPLY (sẽ ghi thật vào DB)' : 'DRY-RUN (chỉ xem trước, chưa ghi gì)'}`);
  console.log(`Target DEMO_USER_ID: ${DEMO_USER_ID}\n`);

  let totalOrphans = 0;

  for (const { name, model } of MODELS) {
    const filter = { userId: { $ne: DEMO_USER_ID } };
    const orphanCount = await model.countDocuments(filter);

    if (orphanCount === 0) {
      console.log(`${name}: 0 document mồ côi`);
      continue;
    }

    totalOrphans += orphanCount;

    if (apply) {
      const result = await model.updateMany(filter, { $set: { userId: DEMO_USER_ID } });
      console.log(`${name}: đã sửa ${result.modifiedCount}/${orphanCount} document -> userId=${DEMO_USER_ID}`);
    } else {
      console.log(`${name}: ${orphanCount} document mồ côi (sẽ sửa nếu chạy lại với --apply)`);
    }
  }

  console.log(`\nTổng document mồ côi: ${totalOrphans}`);
  if (!apply && totalOrphans > 0) {
    console.log('Đây là DRY-RUN - chưa có gì được ghi. Chạy lại với: npm run seed:fix-orphans -- --apply');
  }

  process.exit(0);
};

run().catch((error) => {
  console.error('migrate-orphans failed:', error);
  process.exit(1);
});
