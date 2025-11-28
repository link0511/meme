export interface StickerGenerationState {
  isLoading: boolean;
  error: string | null;
  generatedImage: string | null; // Base64 string or URL
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT = "3:4",
  LANDSCAPE = "4:3",
  WIDE = "16:9",
  TALL = "9:16"
}