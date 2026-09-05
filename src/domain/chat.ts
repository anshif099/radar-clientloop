export type ChatKind = "COMPANY" | "AI";
export interface ChatAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}
export interface ChatMessage {
  id: number;
  senderId: string;
  senderName: string;
  senderRole: "ADMIN" | "COMPANY" | "ASSISTANT";
  body: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  attachments: ChatAttachment[];
}
export const chatAccept = ".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.m4v,.mp3,.wav,.ogg,.oga,.m4a,.aac,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip";
export const maxChatFiles = 5;
export const maxChatBytes = 100 * 1024 * 1024;
export const maxChatText = 8000;
