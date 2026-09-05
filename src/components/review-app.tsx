"use client";

import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  FileImage,
  FolderKanban,
  Home,
  LogOut,
  MessageCircleMore,
  MoreHorizontal,
  RotateCcw,
  Send,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { authClient } from "@/auth/client";
import { PwaInstall } from "./pwa-install";
import { AssetPreview } from "./asset-preview";
import { assetActionHref, type ContentType } from "@/domain/asset-types";
import { CategoryFilters } from "./work-categories";
import { allCategories, matchesCategoryFilter, workClassificationLabel, type CategorizedWork } from "@/domain/work-categories";

export type Decision = "pending" | "approved" | "changes" | "rejected";
type Filter = "all" | Decision;
type WorkspaceView = "review" | "dashboard" | "downloads";
type DateRange = "day" | "week" | "month" | "year" | "all";
type SortOrder = "newest" | "oldest";

export interface ReviewWorkItem extends CategorizedWork {
  id: string;
  title: string;
  project: string;
  publishedAt: string;
  version: number;
  decision: Decision;
  preview: string;
  contentType: ContentType;
  originalName: string;
  comments: number;
  note: string;
}

export interface ReviewProject {
  id: string;
  name: string;
  posterCount: number;
  createdAt: string;
}

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "changes", label: "Changes" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
];

const dateRanges: Array<{ value: DateRange; label: string }> = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
  { value: "all", label: "Overall" },
];

const statusCopy: Record<Decision, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  changes: "Changes requested",
  rejected: "Rejected",
};

function isInDateRange(value: string, range: DateRange) {
  if (range === "all") return true;
  const date = new Date(value);
  const cutoff = new Date();
  if (range === "day") cutoff.setHours(0, 0, 0, 0);
  if (range === "week") cutoff.setDate(cutoff.getDate() - 7);
  if (range === "month") cutoff.setMonth(cutoff.getMonth() - 1);
  if (range === "year") cutoff.setFullYear(cutoff.getFullYear() - 1);
  return date >= cutoff;
}

function countByStatus(items: ReviewWorkItem[]) {
  return {
    all: items.length,
    pending: items.filter((item) => item.decision === "pending").length,
    approved: items.filter((item) => item.decision === "approved").length,
    changes: items.filter((item) => item.decision === "changes").length,
    rejected: items.filter((item) => item.decision === "rejected").length,
  };
}

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

function Sidebar({ view, onChange }: { view: WorkspaceView; onChange: (view: WorkspaceView) => void }) {
  return (
    <aside className="desktop-sidebar">
      <BrandMark />
      <nav aria-label="Main navigation">
        <button className={view === "review" ? "nav-item active" : "nav-item"} type="button" onClick={() => onChange("review")}><Home size={21} strokeWidth={2.4} /><span>Review</span></button>
        <button className={view === "dashboard" ? "nav-item active" : "nav-item"} type="button" onClick={() => onChange("dashboard")}><BarChart3 size={21} /><span>Dashboard</span></button>
        <button className={view === "downloads" ? "nav-item active" : "nav-item"} type="button" onClick={() => onChange("downloads")}><Download size={21} /><span>Downloads</span></button>
        <Link className="nav-item" href="/messages"><MessageCircleMore size={21} /><span>Messages & AI</span></Link>
      </nav>
      <div className="sidebar-bottom"><PwaInstall /><SignOutButton /></div>
    </aside>
  );
}

function MobileNavigation({ view, onChange }: { view: WorkspaceView; onChange: (view: WorkspaceView) => void }) {
  return (
    <nav className="mobile-navigation" aria-label="Mobile navigation">
      <button className={view === "review" ? "mobile-nav-item active" : "mobile-nav-item"} type="button" onClick={() => onChange("review")}><Home size={23} /><span>Review</span></button>
      <button className={view === "dashboard" ? "mobile-nav-item active" : "mobile-nav-item"} type="button" onClick={() => onChange("dashboard")}><BarChart3 size={23} /><span>Dashboard</span></button>
      <button className={view === "downloads" ? "mobile-nav-item active" : "mobile-nav-item"} type="button" onClick={() => onChange("downloads")}><Download size={23} /><span>Downloads</span></button>
      <Link className="mobile-nav-item" href="/messages"><MessageCircleMore size={23} /><span>Messages</span></Link>
      <SignOutButton compact />
    </nav>
  );
}

function ActivitySummary({ items, companyName }: { items: ReviewWorkItem[]; companyName: string }) {
  const counts = countByStatus(items);
  const progress = counts.all ? (counts.approved / counts.all) * 360 : 0;
  return (
    <aside className="context-sidebar">
      <div className="context-head"><div><p className="eyebrow">Company workspace</p><h2>{companyName}</h2></div></div>
      <section className="progress-card" aria-label="Review progress">
        <div className="progress-ring" style={{ "--progress": `${progress}deg` } as React.CSSProperties}><span>{counts.approved}/{counts.all}</span></div>
        <div><p className="progress-title">Review progress</p><p className="small-copy">{counts.pending} waiting for your response</p></div>
      </section>
      <section className="summary-section">
        <div className="section-heading-row"><h3>Filtered posters</h3><span>{counts.all} total</span></div>
        <div className="metric-grid">
          <div className="metric approved-metric"><span>{counts.approved}</span><small>Approved</small></div>
          <div className="metric pending-metric"><span>{counts.pending}</span><small>Pending</small></div>
          <div className="metric"><span>{counts.changes}</span><small>Changes</small></div>
          <div className="metric rejected-metric"><span>{counts.rejected}</span><small>Rejected</small></div>
        </div>
      </section>
      <div className="privacy-note"><CheckCircle2 size={18} /><p><strong>Private company workspace</strong>Your account can only access posters assigned to {companyName}.</p></div>
    </aside>
  );
}

function FeedbackSheet({ item, decision, busy, onClose, onSubmit }: {
  item: ReviewWorkItem;
  decision: "changes" | "rejected";
  busy: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
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
  item: ReviewWorkItem;
  busy: boolean;
  onApprove: () => void;
  onFeedback: (decision: "changes" | "rejected") => void;
}) {
  const published = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.publishedAt));
  return (
    <article className="work-card">
      <header className="work-card-header">
        <div className="work-avatar">R</div>
        <div className="work-heading"><div className="title-row"><h2>{item.title}</h2><span className={`status-dot status-${item.decision}`} title={statusCopy[item.decision]} /></div><p>{item.project} · v{item.version} · {published}</p></div>
        <button className="icon-button" type="button" aria-label={`More options for ${item.title}`}><MoreHorizontal size={21} /></button>
      </header>
      <div className={`preview-frame poster-preview content-preview-${item.contentType}`}>
        <AssetPreview src={item.preview} title={item.title} contentType={item.contentType} originalName={item.originalName} watermark />
        <span className={`preview-status status-pill status-${item.decision}`}>{statusCopy[item.decision]}</span>
      </div>
      <div className="work-body">
        <p className="work-classification">{workClassificationLabel(item)}</p>
        <div className="engagement-row"><span><MessageCircleMore size={18} /> {item.comments} reviews</span></div>
        {item.note ? <p className="work-note"><strong>Rainhopes Team</strong> {item.note}</p> : null}
        <Link className="chat-review-link" href={`/messages?mode=ai&post=${item.id}`}><Sparkles size={16} />Review with AI Ultra</Link>
        {item.decision === "approved" ? (
          <div className="approved-message" role="status"><CheckCircle2 size={20} /><div><strong>Approved</strong><span>This item is ready to use.</span></div><a href={assetActionHref(item.preview, item.contentType)} target={item.contentType === "website" ? "_blank" : undefined} rel={item.contentType === "website" ? "noopener noreferrer" : undefined} aria-label={item.contentType === "website" ? "Open approved website" : "Download approved file"}>{item.contentType === "website" ? <ExternalLink size={19} /> : <Download size={19} />}</a></div>
        ) : item.decision === "changes" ? (
          <div className="changes-message" role="status"><RotateCcw size={20} /><div><strong>Changes requested</strong><span>Waiting for a revised poster from Rainhopes.</span></div></div>
        ) : item.decision === "rejected" ? (
          <div className="changes-message rejected-message" role="status"><XCircle size={20} /><div><strong>Poster rejected</strong><span>Your feedback was sent to Rainhopes.</span></div></div>
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

function DateRangeSelect({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <label className="portal-range-select">
      <CalendarDays size={16} />
      <span className="sr-only">Activity period</span>
      <select value={value} onChange={(event) => onChange(event.target.value as DateRange)}>
        {dateRanges.map((range) => <option value={range.value} key={range.value}>{range.label}</option>)}
      </select>
    </label>
  );
}

function DashboardView({ projects, items, dateRange, onDateRange, onOpenProject, categoryFilters }: {
  projects: ReviewProject[];
  items: ReviewWorkItem[];
  dateRange: DateRange;
  onDateRange: (range: DateRange) => void;
  onOpenProject: (projectName: string) => void;
  categoryFilters: React.ReactNode;
}) {
  const counts = countByStatus(items);
  return (
    <div className="portal-view-container">
      <section className="portal-page-header">
        <div><p className="eyebrow">Workspace overview</p><h1>Dashboard</h1><p>Review progress across all your projects.</p></div>
        <DateRangeSelect value={dateRange} onChange={onDateRange} />
      </section>
      {categoryFilters}
      <section className="portal-summary-grid" aria-label="Poster counts">
        <div><span className="portal-summary-icon all"><Sparkles size={20} /></span><p><strong>{counts.all}</strong><small>All posters</small></p></div>
        <div><span className="portal-summary-icon pending"><Clock3 size={20} /></span><p><strong>{counts.pending}</strong><small>Pending</small></p></div>
        <div><span className="portal-summary-icon approved"><Check size={20} /></span><p><strong>{counts.approved}</strong><small>Approved</small></p></div>
        <div><span className="portal-summary-icon changes"><RotateCcw size={20} /></span><p><strong>{counts.changes}</strong><small>Changes</small></p></div>
        <div><span className="portal-summary-icon rejected"><X size={20} /></span><p><strong>{counts.rejected}</strong><small>Rejected</small></p></div>
      </section>
      <section className="portal-project-section">
        <div className="portal-section-title"><div><p className="eyebrow">All work</p><h2>Projects</h2></div><span>{projects.length} total</span></div>
        {projects.length ? (
          <div className="portal-project-grid">
            {projects.map((project) => {
              const projectItems = items.filter((item) => item.project === project.name);
              const projectCounts = countByStatus(projectItems);
              return (
                <button type="button" key={project.id} onClick={() => onOpenProject(project.name)}>
                  <span className="portal-project-icon"><FolderKanban size={22} /></span>
                  <span className="portal-project-copy"><strong>{project.name}</strong><small>{projectCounts.all} posters matching filters</small></span>
                  <span className="portal-project-counts"><em>{projectCounts.pending} pending</em><em>{projectCounts.approved} approved</em></span>
                  <ArrowRight size={18} />
                </button>
              );
            })}
          </div>
        ) : <div className="empty-state"><FolderKanban size={34} /><h2>No projects yet</h2><p>Your projects will appear here when they are created.</p></div>}
      </section>
    </div>
  );
}

function DownloadsView({ items, projects, projectFilter, dateRange, onProjectFilter, onDateRange, categoryFilters }: {
  items: ReviewWorkItem[];
  projects: ReviewProject[];
  projectFilter: string;
  dateRange: DateRange;
  onProjectFilter: (project: string) => void;
  categoryFilters: React.ReactNode;
  onDateRange: (range: DateRange) => void;
}) {
  const downloads = items.filter((item) => item.decision === "approved");
  return (
    <div className="portal-view-container">
      <section className="portal-page-header">
        <div><p className="eyebrow">Approved content</p><h1>Downloads</h1><p>Download approved files or open website links from every project.</p></div>
        <DateRangeSelect value={dateRange} onChange={onDateRange} />
      </section>
      <div className="portal-toolbar">
        <label><FolderKanban size={16} /><span className="sr-only">Project</span><select value={projectFilter} onChange={(event) => onProjectFilter(event.target.value)}><option value="all">All projects</option>{projects.map((project) => <option value={project.name} key={project.id}>{project.name}</option>)}</select></label>
        <span>{downloads.length} approved {downloads.length === 1 ? "item" : "items"}</span>
      </div>
      {categoryFilters}
      {downloads.length ? (
        <section className="portal-download-grid">
          {downloads.map((item) => (
            <article key={item.id}>
              <div><AssetPreview src={item.preview} title={item.title} contentType={item.contentType} compact /><span className="download-status"><CheckCircle2 size={14} />Approved</span></div>
              <section><div><strong>{item.title}</strong><small>{item.project} · Version {item.version}</small><small>{workClassificationLabel(item)}</small></div><a href={assetActionHref(item.preview, item.contentType)} target={item.contentType === "website" ? "_blank" : undefined} rel={item.contentType === "website" ? "noopener noreferrer" : undefined} aria-label={`${item.contentType === "website" ? "Open" : "Download"} ${item.title}`}>{item.contentType === "website" ? <ExternalLink size={18} /> : <Download size={18} />}</a></section>
            </article>
          ))}
        </section>
      ) : <div className="empty-state"><Download size={34} /><h2>No approved downloads</h2><p>Approved posters matching these filters will appear here.</p></div>}
    </div>
  );
}

export function ReviewApp({ initialItems, initialProjects, companyName, viewerName }: {
  initialItems: ReviewWorkItem[];
  initialProjects: ReviewProject[];
  companyName: string;
  viewerName: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<WorkspaceView>("review");
  const [filter, setFilter] = useState<Filter>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [categoryFilter, setCategoryFilter] = useState(allCategories);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [feedback, setFeedback] = useState<{ itemId: string; decision: "changes" | "rejected" } | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const dateItems = useMemo(
    () => items.filter((item) => isInDateRange(item.publishedAt, dateRange)),
    [dateRange, items],
  );
  const categoryItems = useMemo(
    () => dateItems.filter((item) => matchesCategoryFilter(item, categoryFilter)),
    [dateItems, categoryFilter],
  );
  const projectItems = useMemo(
    () => projectFilter === "all" ? categoryItems : categoryItems.filter((item) => item.project === projectFilter),
    [categoryItems, projectFilter],
  );
  const visibleItems = useMemo(() => {
    const result = filter === "all" ? [...projectItems] : projectItems.filter((item) => item.decision === filter);
    return result.sort((left, right) => {
      const difference = new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
      return sortOrder === "newest" ? difference : -difference;
    });
  }, [filter, projectItems, sortOrder]);
  const counts = countByStatus(projectItems);
  const feedbackItem = feedback ? items.find((item) => item.id === feedback.itemId) : undefined;
  const categoryFilters = <CategoryFilters value={categoryFilter} onChange={setCategoryFilter} />;

  const openProject = (projectName: string) => {
    setProjectFilter(projectName);
    setFilter("all");
    setView("review");
  };

  const changeView = (nextView: WorkspaceView) => {
    if (nextView === "dashboard") setProjectFilter("all");
    setView(nextView);
  };

  const submitDecision = async (itemId: string, decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT", note?: string) => {
    setBusyItem(itemId);
    try {
      const response = await fetch(`/api/v1/company/posters/${itemId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback: note, idempotencyKey: crypto.randomUUID() }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Review could not be saved.");
      const nextDecision: Decision = decision === "APPROVE" ? "approved" : decision === "REJECT" ? "rejected" : "changes";
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
      <Sidebar view={view} onChange={changeView} />
      <main className="workspace-main">
        <header className="mobile-topbar"><BrandMark /><div className="mobile-top-actions"><PwaInstall /><Bell size={22} /></div></header>
        {view === "dashboard" ? (
          <DashboardView projects={initialProjects} items={categoryItems} dateRange={dateRange} onDateRange={setDateRange} onOpenProject={openProject} categoryFilters={categoryFilters} />
        ) : view === "downloads" ? (
          <DownloadsView items={projectItems} projects={initialProjects} projectFilter={projectFilter} dateRange={dateRange} onProjectFilter={setProjectFilter} onDateRange={setDateRange} categoryFilters={categoryFilters} />
        ) : (
          <div className="feed-container">
            <section className="feed-intro"><div><p className="eyebrow">Welcome, {viewerName}</p><h1>{projectFilter === "all" ? "Your poster feed" : projectFilter}</h1><p>{counts.pending} {counts.pending === 1 ? "poster needs" : "posters need"} your attention.</p></div><DateRangeSelect value={dateRange} onChange={setDateRange} /></section>
            <section className="quick-stats portal-five-stats" aria-label="Workspace highlights">
              <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><span className="story-ring"><Sparkles size={21} /></span><strong>{counts.all}</strong><small>All</small></button>
              <button type="button" className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}><span className="story-ring"><Clock3 size={22} /></span><strong>{counts.pending}</strong><small>Pending</small></button>
              <button type="button" className={filter === "approved" ? "active" : ""} onClick={() => setFilter("approved")}><span className="story-ring"><Check size={23} /></span><strong>{counts.approved}</strong><small>Approved</small></button>
              <button type="button" className={filter === "changes" ? "active" : ""} onClick={() => setFilter("changes")}><span className="story-ring"><RotateCcw size={21} /></span><strong>{counts.changes}</strong><small>Changes</small></button>
              <button type="button" className={filter === "rejected" ? "active" : ""} onClick={() => setFilter("rejected")}><span className="story-ring"><X size={21} /></span><strong>{counts.rejected}</strong><small>Rejected</small></button>
            </section>
            <div className="portal-toolbar review-toolbar">
              <label><FolderKanban size={16} /><span className="sr-only">Project</span><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">All projects</option>{initialProjects.map((project) => <option value={project.name} key={project.id}>{project.name}</option>)}</select></label>
              <button className="sort-button" type="button" onClick={() => setSortOrder((order) => order === "newest" ? "oldest" : "newest")}>{sortOrder === "newest" ? "Newest" : "Oldest"}<ChevronDown size={15} /></button>
            </div>
            {categoryFilters}
            <div className="filter-row"><div className="filter-scroll" role="group" aria-label="Filter poster feed">{filters.map((option) => <button className={filter === option.value ? "filter-chip active" : "filter-chip"} type="button" key={option.value} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}<span>{counts[option.value]}</span></button>)}</div></div>
            <section className="work-feed" aria-live="polite">{visibleItems.length ? visibleItems.map((item) => <WorkCard key={item.id} item={item} busy={busyItem === item.id} onApprove={() => submitDecision(item.id, "APPROVE")} onFeedback={(decision) => setFeedback({ itemId: item.id, decision })} />) : <div className="empty-state"><FileImage size={34} /><h2>No posters here</h2><p>No posters match the selected project, period, category, subcategory, and status filters.</p></div>}</section>
            <footer className="feed-footer"><span>Private workspace secured by ClientLoop</span></footer>
          </div>
        )}
      </main>
      <ActivitySummary items={view === "dashboard" ? categoryItems : projectItems} companyName={companyName} />
      <MobileNavigation view={view} onChange={changeView} />
      {feedback && feedbackItem ? <FeedbackSheet item={feedbackItem} decision={feedback.decision} busy={busyItem === feedback.itemId} onClose={() => setFeedback(null)} onSubmit={(note) => submitDecision(feedback.itemId, feedback.decision === "changes" ? "REQUEST_CHANGES" : "REJECT", note)} /> : null}
      {toast ? <div className="toast" role="status"><CheckCircle2 size={19} />{toast}</div> : null}
    </div>
  );
}
