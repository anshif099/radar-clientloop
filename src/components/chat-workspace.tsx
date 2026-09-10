"use client";

import Link from "next/link";
import { ArrowLeft, CheckCheck, Download, FileText, LoaderCircle, MessageSquareText, Mic, Paperclip, Send, ShieldCheck, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { chatAccept, maxChatBytes, maxChatFiles, maxChatText, type ChatAttachment, type ChatMessage } from "@/domain/chat";
import { WritingAssistant } from "./writing-assistant";

function formatBytes(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`; }
async function jsonResponse<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => ({ message: "The server could not complete this request." }));
  if (!response.ok) throw new Error(result.message ?? "Request failed. Please try again.");
  return result as T;
}
function Attachment({ attachment, companyId }: { attachment: ChatAttachment; companyId: string }) {
  const url = `/api/v1/chat/attachments/${attachment.id}?companyId=${encodeURIComponent(companyId)}`;
  return <div className="chat-attachment">
    {attachment.mimeType.startsWith("image/") ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={attachment.originalName} loading="lazy" /></a>
      : attachment.mimeType.startsWith("video/") ? <video src={url} controls preload="metadata" playsInline />
      : attachment.mimeType.startsWith("audio/") ? <audio src={url} controls preload="metadata" />
      : attachment.mimeType === "application/pdf" ? <iframe src={url} title={attachment.originalName} loading="lazy" /> : null}
    <a className="chat-file-link" href={`${url}&download=1`}><FileText size={17} /><span><strong>{attachment.originalName}</strong><small>{formatBytes(attachment.sizeBytes)}</small></span><Download size={16} /></a>
  </div>;
}
function RevisionSources({ message, isAdmin }: { message: ChatMessage; isAdmin: boolean }) {
  const versions = message.metadata.versions;
  if (!Array.isArray(versions)) return null;
  return <div className="chat-sources">{versions.map((value: unknown) => {
    if (!value || typeof value !== "object" || !("assetId" in value) || typeof value.assetId !== "string" || !("versionNumber" in value) || typeof value.versionNumber !== "number") return null;
    return <a key={value.assetId} href={`/api/v1/${isAdmin ? "admin" : "company"}/assets/${encodeURIComponent(value.assetId)}`} target="_blank" rel="noopener noreferrer">Open version {value.versionNumber}</a>;
  })}</div>;
}
export function ChatWorkspace({ companies, companyId: initialCompanyId, userId, isAdmin }: {
  companies: Array<{ id: string; name: string }>; companyId: string; userId: string; isAdmin: boolean;
}) {
  const company = companies.find(({ id }) => id === initialCompanyId);
  return <main className="chat-shell">
    <aside className="chat-sidebar">
      <Link className="chat-back" href={isAdmin ? "/admin" : "/company"}><ArrowLeft size={18} />Back to workspace</Link>
      <div className="chat-brand"><img src="/brand/app-icon.svg" alt="" width="40" height="40" /><div><strong>ClientLoop</strong><span>Conversations</span></div></div>
      {isAdmin ? <label className="chat-company-select">Company<select aria-label="Chat company" value={initialCompanyId} onChange={(event) => { window.location.assign(`/messages?companyId=${encodeURIComponent(event.target.value)}`); }}>
        {companies.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
      </select></label> : <p className="chat-company-name">{company?.name}</p>}
      <nav className="chat-tabs" aria-label="Conversations">
        <span className="active"><MessageSquareText size={22} /><span><strong>Company chat</strong><small>{isAdmin ? "Talk with your client" : "Talk with Rainhopes"}</small></span></span>
      </nav>
      <div className="chat-privacy"><ShieldCheck size={20} /><p>This conversation is private to your company workspace. Use Check writing before sending when you want spelling and grammar help.</p></div>
    </aside>
    {company ? <ChatRoom key={company.id} companyId={company.id} companyName={company.name} userId={userId} isAdmin={isAdmin} />
      : <section className="chat-empty"><MessageSquareText size={44} /><h1>No company yet</h1><p>Create a company to start chatting.</p><Link href="/admin">Go to admin</Link></section>}
  </main>;
}

function ChatRoom({ companyId, companyName, userId, isAdmin }: {
  companyId: string; companyName: string; userId: string; isAdmin: boolean;
}) {
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const lastId = useRef(0);
  const pendingId = useRef<string | null>(null);
  const pendingFingerprint = useRef("");
  const sendInFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const query = `companyId=${encodeURIComponent(companyId)}`;

  function merge(incoming: ChatMessage[]) {
    lastId.current = Math.max(lastId.current, ...incoming.map((message) => message.id));
    const nearBottom = !scroll.current || scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 100;
    setMessages((current) => [...new Map([...current, ...incoming].map((message) => [message.id, message])).values()].sort((a, b) => a.id - b.id));
    if (nearBottom) requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; });
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      microphone.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh(id: string, initial = false) {
      try {
        const result = await jsonResponse<{ messages: ChatMessage[]; hasMore: boolean }>(await fetch(`/api/v1/chat/threads/${id}/messages?${query}${!initial ? `&after=${lastId.current}` : ""}`, { cache: "no-store", signal: controller.signal }));
        if (controller.signal.aborted) return;
        merge(result.messages);
        if (initial) { setHasOlder(result.hasMore); setLoading(false); requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }); }
        setConnected(true);
        // Drain additional pages before returning to the normal polling interval.
        timer = setTimeout(() => refresh(id), !initial && result.hasMore ? 100 : 3000);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setConnected(false);
        if (initial) { setError(cause instanceof Error ? cause.message : "Could not load chat."); setLoading(false); }
        timer = setTimeout(() => refresh(id, initial), 5000);
      }
    }
    async function start() {
      setLoading(true); setError("");
      try {
        const result = await jsonResponse<{ thread: { id: string } }>(await fetch(`/api/v1/chat/threads?${query}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "COMPANY" }), signal: controller.signal }));
        if (controller.signal.aborted) return;
        setThreadId(result.thread.id);
        await refresh(result.thread.id, true);
      } catch (cause) { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "Could not open chat."); setLoading(false); } }
    }
    void start();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, retry]);

  async function older() {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    const height = scroll.current?.scrollHeight ?? 0;
    const top = scroll.current?.scrollTop ?? 0;
    try {
      const result = await jsonResponse<{ messages: ChatMessage[]; hasMore: boolean }>(await fetch(`/api/v1/chat/threads/${threadId}/messages?${query}&before=${messages[0].id}`, { cache: "no-store" }));
      if (!alive.current) return;
      merge(result.messages); setHasOlder(result.hasMore);
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = top + scroll.current.scrollHeight - height; });
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Could not load older messages."); }
    finally { if (alive.current) setLoadingOlder(false); }
  }
  function addFiles(incoming: File[]) {
    setFiles((current) => {
      const next = [...current, ...incoming];
      if (next.length > maxChatFiles || next.reduce((sum, file) => sum + file.size, 0) > maxChatBytes) { setError("Attach up to 5 files totaling 100 MB or less."); return current; }
      return next;
    });
    pendingId.current = null;
  }
  async function send(text = body) {
    if (sendInFlight.current || sending || recording || requestingMic || !threadId || (!text.trim() && !files.length)) return;
    sendInFlight.current = true;
    setSending(true); setError("");
    const fingerprint = JSON.stringify([text, files.map((file) => [file.name, file.size, file.lastModified])]);
    if (fingerprint !== pendingFingerprint.current) pendingId.current = null;
    pendingFingerprint.current = fingerprint;
    pendingId.current ??= crypto.randomUUID();
    const clientMessageId = pendingId.current;
    const form = new FormData();
    form.set("body", text); form.set("clientMessageId", clientMessageId);
    form.set("after", String(lastId.current));
    files.forEach((file) => form.append("files", file));
    try {
      const result = await jsonResponse<{ messages: ChatMessage[] }>(await fetch(`/api/v1/chat/threads/${threadId}/messages?${query}`, { method: "POST", body: form }));
      if (!alive.current) return;
      setConnected(true);
      merge(result.messages);
      setBody(""); setFiles([]);
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; });
      pendingId.current = null;
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "The message could not be sent. Retry it."); }
    finally { sendInFlight.current = false; if (alive.current) setSending(false); }
  }
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Voice recording requires HTTPS and a supported browser. You can attach an audio file instead."); return; }
    setRequestingMic(true); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      microphone.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) { stream.getTracks().forEach((track) => track.stop()); setError("This browser cannot record a supported audio format. Attach an audio file instead."); return; }
      const capture = new MediaRecorder(stream, { mimeType });
      recorder.current = capture;
      const chunks: Blob[] = [];
      let size = 0;
      capture.ondataavailable = (event) => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size >= 24 * 1024 * 1024 && capture.state === "recording") capture.stop(); } };
      capture.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimer.current) clearTimeout(recordingTimer.current);
        if (!alive.current) return;
        const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File(chunks, `voice-${Date.now()}.${extension}`, { type: mimeType });
        if (file.size) addFiles([file]);
        setRecording(false);
      };
      capture.onerror = () => { stream.getTracks().forEach((track) => track.stop()); if (alive.current) { setRecording(false); setError("Recording failed. Please try again."); } };
      capture.start(1000); setRecording(true);
      recordingTimer.current = setTimeout(() => { if (capture.state === "recording") capture.stop(); }, 5 * 60 * 1000);
    } catch { microphone.current?.getTracks().forEach((track) => track.stop()); if (alive.current) setError("Microphone access was unavailable. Allow microphone access or attach an audio file."); }
    finally { if (alive.current) setRequestingMic(false); }
  }

  return <section className="chat-room" aria-label="Company chat">
    <header className="chat-room-header"><span className="chat-room-avatar"><MessageSquareText size={25} /></span><div><h1>{companyName}</h1><p>{loading ? "Loading history…" : !connected ? "Reconnecting…" : "Company chat · Refreshes automatically"}</p></div><ShieldCheck size={20} /></header>
    <div className="chat-timeline" ref={scroll} role="log" aria-label="Message history" aria-live="polite" aria-busy={loading}>
      {hasOlder ? <button type="button" className="chat-load-older" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? "Loading…" : "Load older messages"}</button> : null}
      {loading ? <div className="chat-empty"><LoaderCircle className="chat-spinner" size={30} /><p>Loading saved messages…</p></div> : !messages.length ? <div className="chat-empty"><span><MessageSquareText size={38} /></span><h2>Start the conversation</h2><p>Keep messages, feedback, and files together. Everyone in this company conversation can read the saved history.</p><small>Text · Images · Video · Voice · PDFs · Documents</small></div> : null}
      {messages.map((message) => <article key={message.id} className={`chat-message ${message.senderId === userId ? "own" : ""} ${message.senderRole === "ASSISTANT" ? "assistant" : ""}`}>
        <div className="chat-message-author"><strong>{message.senderId === userId ? "You" : message.senderName}</strong><span>{message.senderRole === "ADMIN" ? "Admin" : message.senderRole === "ASSISTANT" ? "Archived assistant" : "Company"}</span></div>
        <div className="chat-bubble">{message.body ? <p>{message.body}</p> : null}{message.attachments.map((attachment) => <Attachment attachment={attachment} companyId={companyId} key={attachment.id} />)}<RevisionSources message={message} isAdmin={isAdmin} /></div>
        <div className="chat-message-time"><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>{message.senderId === userId ? <span title="Saved to database"><CheckCheck size={13} /><span className="sr-only">Saved</span></span> : null}</div>
      </article>)}
      {sending ? <p className="chat-sending" role="status"><LoaderCircle className="chat-spinner" size={15} />Saving your message…</p> : null}
    </div>
    {error ? <div className="chat-error" role="alert"><span>{error}</span>{!threadId ? <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button> : null}<button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div> : null}
    <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      {files.length ? <div className="chat-pending-files">{files.map((file, index) => <span key={`${file.name}:${index}`}><Paperclip size={13} /><span>{file.name}<small>{formatBytes(file.size)}</small></span><button type="button" disabled={sending} aria-label={`Remove ${file.name}`} onClick={() => { setFiles((current) => current.filter((_, i) => i !== index)); pendingId.current = null; }}><X size={14} /></button></span>)}</div> : null}
      <div className="chat-compose-row">
        <input type="file" ref={fileInput} accept={chatAccept} multiple hidden onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /><button className="chat-tool" type="button" disabled={sending || loading || files.length >= maxChatFiles} onClick={() => fileInput.current?.click()} aria-label="Attach files"><Paperclip size={20} /></button>
        <textarea aria-label="Message" rows={2} maxLength={maxChatText} value={body} disabled={sending || loading} placeholder="Write a message…" onChange={(event) => { setBody(event.target.value); pendingId.current = null; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} spellCheck />
        <button className={`chat-tool ${recording ? "recording" : ""}`} type="button" disabled={sending || loading || requestingMic || (!recording && files.length >= maxChatFiles)} onClick={() => recording ? recorder.current?.stop() : void startRecording()} aria-label={recording ? "Stop recording" : "Record voice message"}>{recording ? <Square size={18} /> : <Mic size={20} />}</button>
        <button className="chat-send" type="submit" disabled={sending || loading || !threadId || recording || requestingMic || (!body.trim() && !files.length)} aria-label="Send message"><Send size={19} /></button>
      </div>
      <WritingAssistant value={body} onApply={(corrected) => { setBody(corrected); pendingId.current = null; }} context="message" disabled={sending || loading} compact />
      <p className="chat-composer-help">{recording ? "Recording… stop to attach your voice message. Maximum 5 minutes." : "Up to 5 files · 100 MB total · Images/documents 20 MB · Voice 25 MB · Shift + Enter for a new line"}</p>
    </form>
  </section>;
}
