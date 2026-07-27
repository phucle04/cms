export interface TikTokVideo {
  id: string;
  url: string;
  views: number;
  caption: string;
  captionsUrl?: string;
}

export interface CompetitorTranscript {
  views: number;
  transcript: string;
}
