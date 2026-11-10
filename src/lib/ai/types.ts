import type { Kind } from "../finance";

export const providers = {
  openai: { label: "OpenAI", model: "gpt-5.4-mini" },
  google: { label: "Gemini", model: "gemini-3.5-flash-lite" },
  anthropic: { label: "Claude", model: "claude-haiku-5-5" },
  deepseek: { label: "DeepSeek", model: "deepseek-flash" },
  xai: { label: "Grok", model: "grok-4.7" },
} as const;

export type ProviderId = keyof typeof providers;
export const providerIds = Object.keys(providers) as ProviderId[];
export const maxAttachmentBytes = 4_000_000;
export const maxMessageLength = 6_000;
export const acceptedAttachments =
  ".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.webp";

export type ProviderConnection = {
  id: ProviderId;
  connected: boolean;
  updatedAt: string | null;
};
export type Conversation = {
  id: string;
  provider: ProviderId;
  title: string;
  updatedAt: string;
};
export type Source =
  | {
      type: "record";
      kind: Exclude<Kind, "settings">;
      id: string;
      label: string;
      visit?: boolean;
    }
  | {
      type: "report";
      year: string;
      month: string;
      basis: "cash" | "accrual";
      label: string;
    }
  | { type: "help"; page: string; label: string };
export type Message = {
  id: string;
  turnId: string;
  role: "user" | "assistant";
  text: string;
  sources: Source[];
  attachment: string | null;
};
export type DraftKind = Exclude<Kind, "settings"> | "visit";
export type DraftLine = {
  description: string;
  quantity: string;
  unit: string;
  amount: string;
};
export type DraftValue = string | boolean | DraftLine[];
export type DraftItem = {
  id: string;
  kind: DraftKind;
  location: string;
  data: Record<string, DraftValue>;
  selected: boolean;
  warnings: string[];
};
export type Proposal = {
  id: string;
  turnId: string;
  filename: string;
  version: number;
  status: "pending" | "confirmed" | "discarded" | "expired";
  items: DraftItem[];
  receipt: Source[] | null;
};
