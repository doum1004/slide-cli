export interface SlotDefinition {
  id: string;
  type: "text" | "image" | "color" | "number" | "url";
  label: string;
  required: boolean;
  default?: string | number;
  description?: string;
}

export interface TemplateManifest {
  name: string;
  id: string;
  version: string;
  description: string;
  author?: string;
  aspectRatio: string; // "9:16" | "16:9" | "1:1"
  width: number;
  height: number;
  slots: SlotDefinition[];
  tags?: string[];
}

export interface Template {
  manifest: TemplateManifest;
  html: string;
  dir: string;
  sample: Record<string, unknown> | null;
}

export interface SlideData {
  layout: string;
  [key: string]: unknown;
}

export interface PresentationData {
  title?: string;
  slides: SlideData[];
}

export interface RenderResult {
  slideIndex: number;
  htmlPath: string;
  imagePath: string;
}

export interface CreateOptions {
  data: string;
  template: string;
  out: string;
  format: "png" | "jpg";
  noImages: boolean;
  force: boolean;
}
