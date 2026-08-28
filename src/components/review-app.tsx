"use client";

import {
  BarChart3, Bell, Check, CheckCircle2, ChevronDown, Clock3, Download, Home, LogOut,
  MessageCircleMore, MoreHorizontal, RotateCcw, Send, Sparkles, X,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { authClient } from "@/auth/client";
import { PwaInstall } from "./pwa-install";

export type Decision = "pending" | "approved" | "changes" | "rejected";
type Filter = "all" | Decision;

export interface ReviewWorkItem {
  id: string;
  title: string;
  project: string;
  publishedAt: string;
  version: number;
  decision: Decision;
  preview: string;
  comments: number;
  note: string;
}

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All work" },
  { value: "pending", label: "Pending" },
  { value: "changes", label: "Changes" },
  { value: "approved", label: "Approved" },
];

const statusCopy: Record<Decision, string> = {
  pending: "Awaiting review", approved: "Approved", changes: "Changes requested", rejected: "Rejected",
};

function BrandMark() {
  return (
    <div className="brand-lockup" aria-label="ClientLoop">
      <Image src="/brand/app-icon.svg" width={38} height={38} alt="" priority />
      <span>ClientLoop</span>
    </div>
  );
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const signOut = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };
  return (
    <button className={compact ? "mobile-nav-item" : "nav-item"} type="button" onClick={signOut} aria-label="Sign out">
      <LogOut size={21} aria-hidden="true" /><span>Sign out</span>
    </button>
  );
}

function Sidebar() {
  return (
    <aside className="desktop-sidebar">
      <BrandMark />
      <nav aria-label="Main navigation">
        <button className="nav-item active" type="button"><Home size={21} strokeWidth={2.4} /><span>Review</span></button>
        <button className="nav-item" type="button"><BarChart3 size={21} /><span>Dashboard</span></button>
        <button className="nav-item" type="button"><Download size={21} /><span>Downloads</span></button>
      </nav>
      <div className="sidebar-bottom"><PwaInstall /><SignOutButton /></div>
    </aside>
  );
}

function MobileNavigation() {
  return (
    <nav className="mobile-navigation" aria-label="Mobile navigation">
      <button className="mobile-nav-item active" type="button"><Home size={23} /><span>Review</span></button>
      <button className="mobile-nav-item" type="button"><BarChart3 size={23} /><span>Insights</span></button>
      <button className="mobile-nav-item" type="button"><Download size={23} /><span>Files</span></button>
      <SignOutButton compact />
    </nav>
  );
}

function ActivitySummary({ items, companyName }: { items: ReviewWorkItem[]; companyName: string }) {
  const approved = items.filter((item) => item.decision === "approved").length;
  const pending = items.filter((item) => item.decision === "pending").length;
  const progress = items.length ? (approved / items.length) * 360 : 0;
  return (
    <aside className="context-sidebar">
      <div className="context-head"><div><p className="eyebrow">Company workspace</p><h2>{companyName}</h2></div></div>
      <section className="progress-card" aria-label="Review progress">
        <div className="progress-ring" style={{ "--progress": `${progress}deg` } as React.CSSProperties}><span>{approved}/{items.length}</span></div>
        <div><p className="progress-title">Review progress</p><p className="small-copy">{pending} waiting for your response</p></div>
      </section>
      <section className="summary-section">
        <div className="section-heading-row"><h3>All posters</h3><span>Live</span></div>
        <div className="metric-grid">
          <div className="metric approved-metric"><span>{approved}</span><small>Approved</small></div>
          <div className="metric pending-metric"><span>{pending}</span><small>Pending</small></div>
          <div className="metric"><span>{items.filter((item) => item.decision === "changes").length}</span><small>Changes</small></div>
          <div className="metric"><span>{items.length}</span><small>Delivered</small></div>
        </div>
      </section>
      <div className="privacy-note"><CheckCircle2 size={18} /><p><strong>Private company workspace</strong>Your account can only access posters assigned to {companyName}.</p></div>
    </aside>
  );
}

function FeedbackSheet({ item, decision, busy, onClose, onSubmit }: {
  item: ReviewWorkItem; decision: "changes" | "rejected"; busy: boolean; onClose: () => void; onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const title = decision === "changes" ? "What should we adjust?" : "Why should this poster be rejected?";
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="feedback-sheet" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <div><p className="eyebrow">{item.title} · v{item.version}</p><h2>{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close feedback"><X size={21} /></button>
        </div>
        <p className="sheet-intro">Write in English, Manglish, Malayalam, or any language. Your feedback is stored against this version.</p>
        <label className="feedback-label" htmlFor="feedback-note">Feedback</label>
        <textarea id="feedback-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the required correction…" autoFocus />
        {showValidation && !note.trim() ? <p className="field-error">Please add feedback before sending.</p> : null}
        <button className={decision === "rejected" ? "submit-feedback reject-submit" : "submit-feedback"} type="button" disabled={busy} onClick={() => note.trim() ? onSubmit(note) : setShowValidation(true)}>
          <Send size={18} />{busy ? "Sending…" : decision === "changes" ? "Send change request" : "Reject poster"}
        </button>
      </section>
    </div>
  );
}

function WorkCard({ item, busy, onApprove, onFeedback }: {
  item: ReviewWorkItem; busy: boolean; onApprove: () => void; onFeedback: (decision: "changes" | "rejected") => void;
}) {
  const published = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.publishedAt));
  return (
    <article className="work-card">
      <header className="work-card-header">
        <div className="work-avatar">R</div>
        <div className="work-heading"><div className="title-row"><h2>{item.title}</h2><span className={`status-dot status-${item.decision}`} title={statusCopy[item.decision]} /></div><p>{item.project} · v{item.version} · {published}</p></div>
        <button className="icon-button" type="button" aria-label={`More options for ${item.title}`}><MoreHorizontal size={21} /></button>
      </header>
      <div className="preview-frame poster-preview">
        {/* Direct loading preserves the authenticated cookie on private media requests. */}
        <img src={item.preview} alt={`${item.title} poster`} />
        <span className={`preview-status status-pill status-${item.decision}`}>{statusCopy[item.decision]}</span>
      </div>
      <div className="work-body">
        <div className="engagement-row"><span><MessageCircleMore size={18} /> {item.comments} reviews</span></div>
        {item.note ? <p className="work-note"><strong>Rainhopes Team</strong> {item.note}</p> : null}
        {item.decision === "approved" ? (
          <div className="approved-message" role="status"><CheckCircle2 size={20} /><div><strong>Approved</strong><span>This poster is ready to use.</span></div><a href={`${item.preview}?download=1`} aria-label="Download approved poster"><Download size={19} /></a></div>
        ) : item.decision === "changes" || item.decision === "rejected" ? (
          <div className="changes-message" role="status"><RotateCcw size={20} /><div><strong>Feedback submitted</strong><span>Waiting for a revised poster from Rainhopes.</span></div></div>
        ) : (
          <div className="review-actions" aria-label={`Review actions for ${item.title}`}>
            <button className="approve-action" type="button" disabled={busy} onClick={onApprove}><Check size={19} />Approve</button>
            <button className="changes-action" type="button" disabled={busy} onClick={() => onFeedback("changes")}><RotateCcw size={18} />Changes</button>
            <button className="reject-action" type="button" disabled={busy} onClick={() => onFeedback("rejected")}><X size={19} />Reject</button>
          </div>
        )}
      </div>
    </article>
  );
}

export function ReviewApp({ initialItems, companyName, viewerName }: { initialItems: ReviewWorkItem[]; companyName: string; viewerName: string }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("all");
  const [feedback, setFeedback] = useState<{ itemId: string; decision: "changes" | "rejected" } | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const visibleItems = useMemo(() => filter === "all" ? items : items.filter((item) => item.decision === filter), [filter, items]);
  const pendingCount = items.filter((item) => item.decision === "pending").length;
  const feedbackItem = feedback ? items.find((item) => item.id === feedback.itemId) : undefined;

  const submitDecision = async (itemId: string, decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT", note?: string) => {
    setBusyItem(itemId);
    try {
      const response = await fetch(`/api/v1/company/posters/${itemId}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback: note, idempotencyKey: crypto.randomUUID() }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Review could not be saved.");
      const nextDecision: Decision = decision === "APPROVE" ? "approved" : "changes";
      setItems((current) => current.map((item) => item.id === itemId ? { ...item, decision: nextDecision, comments: item.comments + 1 } : item));
      setFeedback(null);
      setToast(decision === "APPROVE" ? "Poster approved." : "Feedback sent to Rainhopes.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Review could not be saved.");
    } finally {
      setBusyItem(null);
      window.setTimeout(() => setToast(null), 3500);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace-main">
        <header className="mobile-topbar"><BrandMark /><div className="mobile-top-actions"><PwaInstall /><Bell size={22} /></div></header>
        <div className="feed-container">
          <section className="feed-intro"><div><p className="eyebrow">Welcome, {viewerName}</p><h1>Your poster feed</h1><p>{pendingCount} {pendingCount === 1 ? "poster needs" : "posters need"} your attention.</p></div></section>
          <section className="quick-stats" aria-label="Workspace highlights">
            <button type="button"><span className="story-ring"><Clock3 size={22} /></span><strong>{pendingCount}</strong><small>Pending</small></button>
            <button type="button"><span className="story-ring"><Check size={23} /></span><strong>{items.filter((item) => item.decision === "approved").length}</strong><small>Approved</small></button>
            <button type="button"><span className="story-ring"><RotateCcw size={21} /></span><strong>{items.filter((item) => item.decision === "changes").length}</strong><small>Changes</small></button>
            <button type="button"><span className="story-ring"><Sparkles size={21} /></span><strong>{items.length}</strong><small>Delivered</small></button>
          </section>
          <div className="filter-row"><div className="filter-scroll" role="group" aria-label="Filter poster feed">{filters.map((option) => <button className={filter === option.value ? "filter-chip active" : "filter-chip"} type="button" key={option.value} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}{option.value === "pending" && pendingCount ? <span>{pendingCount}</span> : null}</button>)}</div><button className="sort-button" type="button">Newest <ChevronDown size={15} /></button></div>
          <section className="work-feed" aria-live="polite">{visibleItems.length ? visibleItems.map((item) => <WorkCard key={item.id} item={item} busy={busyItem === item.id} onApprove={() => submitDecision(item.id, "APPROVE")} onFeedback={(decision) => setFeedback({ itemId: item.id, decision })} />) : <div className="empty-state"><CheckCircle2 size={34} /><h2>No posters here</h2><p>Posters uploaded for {companyName} will appear here.</p></div>}</section>
          <footer className="feed-footer"><span>Private workspace secured by ClientLoop</span></footer>
        </div>
      </main>
      <ActivitySummary items={items} companyName={companyName} /><MobileNavigation />
      {feedback && feedbackItem ? <FeedbackSheet item={feedbackItem} decision={feedback.decision} busy={busyItem === feedback.itemId} onClose={() => setFeedback(null)} onSubmit={(note) => submitDecision(feedback.itemId, feedback.decision === "changes" ? "REQUEST_CHANGES" : "REJECT", note)} /> : null}
      {toast ? <div className="toast" role="status"><CheckCircle2 size={19} />{toast}</div> : null}
    </div>
  );
}
