"use client";

import {
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Grid2X2,
  Home,
  Link2,
  Menu,
  MessageCircleMore,
  Mic,
  MoreHorizontal,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { PwaInstall } from "./pwa-install";

type Decision = "pending" | "approved" | "changes" | "rejected";
type Filter = "all" | Decision;

interface WorkItem {
  id: string;
  title: string;
  category: string;
  publishedAt: string;
  version: number;
  decision: Decision;
  preview: string;
  ratio: "square" | "landscape";
  comments: number;
  note: string;
}

const initialItems: WorkItem[] = [
  {
    id: "summer-campaign",
    title: "Bright Summer campaign",
    category: "Social media",
    publishedAt: "Today, 10:32 AM",
    version: 3,
    decision: "pending",
    preview: "/mock/summer-campaign.svg",
    ratio: "square",
    comments: 4,
    note: "Final color direction with the warmer headline treatment.",
  },
  {
    id: "brand-deck",
    title: "Morrow identity direction",
    category: "Branding",
    publishedAt: "Yesterday, 4:18 PM",
    version: 2,
    decision: "changes",
    preview: "/mock/brand-deck.svg",
    ratio: "landscape",
    comments: 7,
    note: "Updated identity board after the first review round.",
  },
  {
    id: "web-concept",
    title: "Northline homepage concept",
    category: "Web design",
    publishedAt: "24 Aug, 2:05 PM",
    version: 1,
    decision: "approved",
    preview: "/mock/web-concept.svg",
    ratio: "landscape",
    comments: 2,
    note: "Desktop concept and responsive direction for the new homepage.",
  },
];

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All work" },
  { value: "pending", label: "Pending" },
  { value: "changes", label: "Changes" },
  { value: "approved", label: "Approved" },
];

const statusCopy: Record<Decision, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  changes: "Changes requested",
  rejected: "Rejected",
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="ClientLoop">
      <Image src="/brand/app-icon.svg" width={38} height={38} alt="" priority />
      {!compact ? <span>ClientLoop</span> : null}
    </div>
  );
}

function Sidebar() {
  const items = [
    { label: "Review", icon: Home, active: true },
    { label: "Dashboard", icon: BarChart3 },
    { label: "Downloads", icon: Download },
    { label: "Showcase", icon: Grid2X2 },
  ];

  return (
    <aside className="desktop-sidebar">
      <BrandMark />
      <nav aria-label="Main navigation">
        {items.map(({ label, icon: Icon, active }) => (
          <button className={active ? "nav-item active" : "nav-item"} type="button" key={label}>
            <Icon size={21} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <PwaInstall />
        <button className="nav-item" type="button">
          <Menu size={21} aria-hidden="true" />
          <span>More</span>
        </button>
      </div>
    </aside>
  );
}

function MobileNavigation() {
  return (
    <nav className="mobile-navigation" aria-label="Mobile navigation">
      <button className="mobile-nav-item active" type="button" aria-label="Review">
        <Home size={23} aria-hidden="true" />
        <span>Review</span>
      </button>
      <button className="mobile-nav-item" type="button" aria-label="Dashboard">
        <BarChart3 size={23} aria-hidden="true" />
        <span>Insights</span>
      </button>
      <button className="mobile-nav-item" type="button" aria-label="Downloads">
        <Download size={23} aria-hidden="true" />
        <span>Files</span>
      </button>
      <button className="mobile-nav-item" type="button" aria-label="Notifications">
        <Bell size={23} aria-hidden="true" />
        <span>Updates</span>
      </button>
    </nav>
  );
}

function ActivitySummary({ items }: { items: WorkItem[] }) {
  const approved = items.filter((item) => item.decision === "approved").length;
  const pending = items.filter((item) => item.decision === "pending").length;

  return (
    <aside className="context-sidebar">
      <div className="context-head">
        <div>
          <p className="eyebrow">Client workspace</p>
          <h2>Alora & Co.</h2>
        </div>
        <button className="icon-button" type="button" aria-label="More workspace options">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <section className="progress-card" aria-label="Review progress">
        <div className="progress-ring" style={{ "--progress": `${(approved / items.length) * 360}deg` } as React.CSSProperties}>
          <span>{approved}/{items.length}</span>
        </div>
        <div>
          <p className="progress-title">Review progress</p>
          <p className="small-copy">{pending} item waiting for your response</p>
        </div>
      </section>

      <section className="summary-section">
        <div className="section-heading-row">
          <h3>This month</h3>
          <span>August</span>
        </div>
        <div className="metric-grid">
          <div className="metric approved-metric">
            <span>{approved}</span>
            <small>Approved</small>
          </div>
          <div className="metric pending-metric">
            <span>{pending}</span>
            <small>Pending</small>
          </div>
          <div className="metric">
            <span>1.7</span>
            <small>Avg. rounds</small>
          </div>
          <div className="metric">
            <span>8h</span>
            <small>Avg. reply</small>
          </div>
        </div>
      </section>

      <section className="summary-section">
        <div className="section-heading-row">
          <h3>Rainhopes team</h3>
          <span>3 active</span>
        </div>
        <div className="people-row">
          <span className="person person-coral">AK</span>
          <span className="person person-blue">NM</span>
          <span className="person person-green">SJ</span>
          <div>
            <strong>Design team</strong>
            <small>Usually replies within 2 hours</small>
          </div>
        </div>
      </section>

      <div className="privacy-note">
        <CheckCircle2 size={18} aria-hidden="true" />
        <p>
          <strong>Private workspace</strong>
          Only you and your assigned Rainhopes team can see this review.
        </p>
      </div>
    </aside>
  );
}

function VoiceRecorder({ onRecorded }: { onRecorded: (recorded: boolean) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const toggleRecording = async () => {
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      setHasRecording(true);
      onRecorded(true);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
        setError("Voice recording is not supported here. Attach an audio file instead.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();
      setError(null);
      setIsRecording(true);
    } catch {
      setError("Microphone access was not available. You can attach an audio file instead.");
    }
  };

  return (
    <div className="voice-control">
      <button
        className={isRecording ? "composer-tool recording" : "composer-tool"}
        type="button"
        onClick={toggleRecording}
      >
        <Mic size={18} aria-hidden="true" />
        {isRecording ? "Stop recording" : hasRecording ? "Voice note added" : "Voice note"}
      </button>
      {isRecording ? <span className="recording-indicator">Recording…</span> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

function FeedbackSheet({
  item,
  decision,
  onClose,
  onSubmit,
}: {
  item: WorkItem;
  decision: "changes" | "rejected";
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [hasVoice, setHasVoice] = useState(false);
  const [hasAttachment, setHasAttachment] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const title = decision === "changes" ? "What should we adjust?" : "Tell us why this direction isn’t right";
  const canSubmit = note.trim().length > 0 || hasVoice || hasAttachment;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="feedback-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <div>
            <p className="eyebrow">{item.title} · v{item.version}</p>
            <h2 id="feedback-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close feedback">
            <X size={21} />
          </button>
        </div>
        <p className="sheet-intro">
          Write naturally in English, Manglish, Malayalam, or any language. Your note stays with this version.
        </p>
        <label className="feedback-label" htmlFor="feedback-note">
          Feedback
        </label>
        <textarea
          id="feedback-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="For example: Keep the layout, but make the offer easier to notice…"
          autoFocus
        />
        <div className="composer-tools">
          <label className={hasAttachment ? "composer-tool attached" : "composer-tool"}>
            <Paperclip size={18} aria-hidden="true" />
            {hasAttachment ? "Reference added" : "Attach reference"}
            <input
              type="file"
              accept="image/*,.pdf,audio/*"
              onChange={(event) => setHasAttachment(Boolean(event.target.files?.length))}
            />
          </label>
          <VoiceRecorder onRecorded={setHasVoice} />
          <button className="composer-tool" type="button">
            <Link2 size={18} aria-hidden="true" />
            Add link
          </button>
        </div>
        {showValidation && !canSubmit ? (
          <p className="field-error">Add a note, voice recording, or reference before sending.</p>
        ) : null}
        <button
          className={decision === "rejected" ? "submit-feedback reject-submit" : "submit-feedback"}
          type="button"
          onClick={() => {
            if (!canSubmit) {
              setShowValidation(true);
              return;
            }
            onSubmit(note);
          }}
        >
          <Send size={18} aria-hidden="true" />
          {decision === "changes" ? "Send change request" : "Send rejection feedback"}
        </button>
      </section>
    </div>
  );
}

function WorkCard({
  item,
  onApprove,
  onFeedback,
}: {
  item: WorkItem;
  onApprove: () => void;
  onFeedback: (decision: "changes" | "rejected") => void;
}) {
  return (
    <article className="work-card">
      <header className="work-card-header">
        <div className="work-avatar">R</div>
        <div className="work-heading">
          <div className="title-row">
            <h2>{item.title}</h2>
            <span className={`status-dot status-${item.decision}`} title={statusCopy[item.decision]} />
          </div>
          <p>
            {item.category} <span aria-hidden="true">·</span> v{item.version} <span aria-hidden="true">·</span>{" "}
            {item.publishedAt}
          </p>
        </div>
        <button className="icon-button" type="button" aria-label={`More options for ${item.title}`}>
          <MoreHorizontal size={21} />
        </button>
      </header>

      <div className={`preview-frame preview-${item.ratio}`}>
        <Image src={item.preview} alt={`${item.title} preview`} fill sizes="(max-width: 767px) 100vw, 680px" />
        <span className={`preview-status status-pill status-${item.decision}`}>{statusCopy[item.decision]}</span>
      </div>

      <div className="work-body">
        <div className="engagement-row">
          <span>
            <MessageCircleMore size={18} aria-hidden="true" /> {item.comments} notes
          </span>
          <button type="button">View version history</button>
        </div>
        <p className="work-note">
          <strong>Rainhopes Team</strong> {item.note}
        </p>

        {item.decision === "approved" ? (
          <div className="approved-message" role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>Approved by you</strong>
              <span>The final files are ready to download.</span>
            </div>
            <button type="button" aria-label="Download approved files">
              <Download size={19} />
            </button>
          </div>
        ) : (
          <div className="review-actions" aria-label={`Review actions for ${item.title}`}>
            <button className="approve-action" type="button" onClick={onApprove}>
              <Check size={19} strokeWidth={2.6} aria-hidden="true" />
              Approve
            </button>
            <button className="changes-action" type="button" onClick={() => onFeedback("changes")}>
              <RotateCcw size={18} aria-hidden="true" />
              Changes
            </button>
            <button className="reject-action" type="button" onClick={() => onFeedback("rejected")}>
              <X size={19} aria-hidden="true" />
              Reject
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function ReviewApp() {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("all");
  const [feedback, setFeedback] = useState<{
    itemId: string;
    decision: "changes" | "rejected";
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.decision === filter)),
    [filter, items],
  );

  const feedbackItem = feedback ? items.find((item) => item.id === feedback.itemId) : undefined;
  const pendingCount = items.filter((item) => item.decision === "pending").length;

  const updateDecision = (itemId: string, decision: Decision) => {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, decision } : item)));
  };

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="workspace-main">
        <header className="mobile-topbar">
          <BrandMark compact />
          <div className="mobile-top-actions">
            <PwaInstall />
            <button className="icon-button notification-button" type="button" aria-label="Notifications">
              <Bell size={22} />
              <span className="unread-dot" />
            </button>
          </div>
        </header>

        <div className="feed-container">
          <section className="feed-intro">
            <div>
              <p className="eyebrow">Good morning, Maya</p>
              <h1>Your review feed</h1>
              <p>{pendingCount === 1 ? "One item needs your attention." : `${pendingCount} items need your attention.`}</p>
            </div>
            <div className="desktop-feed-actions">
              <button className="icon-button" type="button" aria-label="Search work">
                <Search size={21} />
              </button>
              <button className="avatar-button" type="button" aria-label="Open account menu">
                MK
              </button>
            </div>
          </section>

          <section className="quick-stats" aria-label="Workspace highlights">
            <button type="button">
              <span className="story-ring pending-story">
                <Clock3 size={22} />
              </span>
              <strong>{pendingCount}</strong>
              <small>Pending</small>
            </button>
            <button type="button">
              <span className="story-ring approved-story">
                <Check size={23} />
              </span>
              <strong>{items.filter((item) => item.decision === "approved").length}</strong>
              <small>Approved</small>
            </button>
            <button type="button">
              <span className="story-ring changes-story">
                <RotateCcw size={21} />
              </span>
              <strong>{items.filter((item) => item.decision === "changes").length}</strong>
              <small>Changes</small>
            </button>
            <button type="button">
              <span className="story-ring delivery-story">
                <Sparkles size={21} />
              </span>
              <strong>16</strong>
              <small>Delivered</small>
            </button>
          </section>

          <div className="filter-row">
            <div className="filter-scroll" role="group" aria-label="Filter review feed">
              {filters.map((option) => (
                <button
                  className={filter === option.value ? "filter-chip active" : "filter-chip"}
                  type="button"
                  key={option.value}
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                  {option.value === "pending" && pendingCount > 0 ? <span>{pendingCount}</span> : null}
                </button>
              ))}
            </div>
            <button className="sort-button" type="button">
              Newest <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>

          <section className="work-feed" aria-live="polite">
            {visibleItems.length ? (
              visibleItems.map((item) => (
                <WorkCard
                  key={item.id}
                  item={item}
                  onApprove={() => {
                    updateDecision(item.id, "approved");
                    announce(`${item.title} approved. The Rainhopes team has been notified.`);
                  }}
                  onFeedback={(decision) => setFeedback({ itemId: item.id, decision })}
                />
              ))
            ) : (
              <div className="empty-state">
                <CheckCircle2 size={34} aria-hidden="true" />
                <h2>Nothing here right now</h2>
                <p>New work matching this filter will appear here.</p>
              </div>
            )}
          </section>

          <footer className="feed-footer">
            <span>Private workspace secured by ClientLoop</span>
            <span aria-hidden="true">·</span>
            <button type="button">Need help?</button>
          </footer>
        </div>
      </main>

      <ActivitySummary items={items} />
      <MobileNavigation />

      {feedback && feedbackItem ? (
        <FeedbackSheet
          item={feedbackItem}
          decision={feedback.decision}
          onClose={() => setFeedback(null)}
          onSubmit={() => {
            updateDecision(feedback.itemId, feedback.decision);
            announce(
              feedback.decision === "changes"
                ? "Change request sent. The team has been notified."
                : "Feedback sent. The item remains open for revision.",
            );
            setFeedback(null);
          }}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <CheckCircle2 size={19} aria-hidden="true" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
