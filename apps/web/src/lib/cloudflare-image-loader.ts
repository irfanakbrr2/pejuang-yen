interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function cloudflareImageLoader({ src }: ImageLoaderParams): string {
  return src;
}
