import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database';
import ResearchJob from '../models/ResearchJob';
import TrendVideo from '../models/TrendVideo';
import { DEMO_USER_ID } from '../middleware/auth';

async function main() {
  await connectDB();
  const job = await ResearchJob.findOne({ userId: DEMO_USER_ID }).sort({ createdAt: -1 });
  console.log('Job:', job?.id, 'status:', job?.status);
  console.log('selectedHashtags:', job?.selectedHashtags);
  console.log('cost:', JSON.stringify(job?.cost, null, 2));
  if (job) {
    const videos = await TrendVideo.find({ jobId: String(job._id) });
    console.log('TrendVideo count:', videos.length);
    videos.forEach((v) => console.log(' -', v.videoId, v.downloadStatus, 'comments:', v.topComments?.length));
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
