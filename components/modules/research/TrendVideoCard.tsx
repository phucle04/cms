'use client';

import { useState } from 'react';
import { Heart, Eye, MessageCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { proxyImageUrl } from '@/lib/api';
import * as Types from '@/lib/types';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}N`;
  return String(n);
}

interface TrendVideoCardProps {
  video: Types.TrendVideo;
}

export function TrendVideoCard({ video }: TrendVideoCardProps) {
  const isTextOnly = video.downloadStatus === 'text_only';
  // Thumbnail TikTok đôi khi trả 403/hết hạn (link CDN có thời hạn) - onError
  // chuyển sang placeholder thay vì để trình duyệt hiện icon ảnh vỡ (G6#11).
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="relative aspect-9/16 bg-muted">
        {video.thumbnailUrl && !thumbnailFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyImageUrl(video.thumbnailUrl)}
            alt={video.caption || 'Video TikTok'}
            className="w-full h-full object-cover"
            onError={() => setThumbnailFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Không có ảnh</div>
        )}
        {isTextOnly && (
          <div className="absolute top-2 left-2">
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle size={12} />
              Không tải được video - chỉ phân tích văn bản
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="space-y-3 p-4 flex-1 flex flex-col">
        <p className="text-sm text-foreground line-clamp-2">{video.caption || '(không có caption)'}</p>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye size={14} /> {formatCount(video.playCount)}
          </span>
          <span className="flex items-center gap-1">
            <Heart size={14} /> {formatCount(video.diggCount)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={14} /> {formatCount(video.commentCount)}
          </span>
        </div>

        <a
          href={video.webVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline w-fit"
        >
          Mở trên TikTok <ExternalLink size={14} />
        </a>

        <div className="mt-auto pt-1">
          {video.analysis ? (
            <Accordion>
              <AccordionItem value="analysis">
                <AccordionTrigger>
                  Xem phân tích AI{video.analysisConfidence === 'low' ? ' (độ tin cậy thấp)' : ''}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">Hook (3 giây đầu)</p>
                      <p className="text-muted-foreground">{video.analysis.hook.firstThreeSeconds}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Hình ảnh: {video.analysis.hook.visualHook} · Lời nói: {video.analysis.hook.spokenHook}
                      </p>
                    </div>

                    {video.analysis.structure.length > 0 && (
                      <div>
                        <p className="font-semibold text-foreground mb-1">Diễn biến theo thời gian</p>
                        <div className="space-y-1">
                          {video.analysis.structure.map((s, i) => (
                            <div key={i} className="flex gap-2 text-muted-foreground">
                              <span className="shrink-0 font-mono text-xs bg-muted rounded px-1.5 py-0.5">
                                {s.tStart}s-{s.tEnd}s
                              </span>
                              <span>
                                {s.whatHappens} <span className="text-muted-foreground">— {s.purpose}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="font-semibold text-foreground">Cách quay/dựng</p>
                      <p className="text-muted-foreground">
                        Góc quay: {video.analysis.production.shotTypes.join(', ') || '—'} · Ánh sáng:{' '}
                        {video.analysis.production.lighting || '—'} · Nhạc: {video.analysis.production.musicStyle || '—'}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">Giả thuyết vì sao viral</p>
                      <p className="text-muted-foreground">{video.analysis.viralHypothesis}</p>
                    </div>

                    {video.analysis.cta && (
                      <div>
                        <p className="font-semibold text-foreground">CTA</p>
                        <p className="text-muted-foreground">{video.analysis.cta}</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            <p className="text-xs text-muted-foreground italic">Chưa có phân tích</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
