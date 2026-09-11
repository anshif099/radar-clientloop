"use client";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileImage,
  FolderKanban,
  FolderPlus,
  GitCompareArrows,
  ImagePlus,
  LogOut,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { authClient } from "@/auth/client";
import { assetActionHref, type ContentType } from "@/domain/asset-types";
import { AssetPreview } from "./asset-preview";
import { UploadContentFields } from "./upload-content-fields";
import { CategoryFilters, UploadCategoryFields } from "./work-categories";
import { allCategories, matchesCategoryFilter, workClassificationLabel, type CategorizedWork } from "@/domain/work-categories";
import type { RevisionCheck } from "@/domain/quality-tools";
import { CorrectableInput, CorrectableTextarea } from "./writing-assistant";
import { subAdminPositions, type SubAdminPosition } from "@/domain/sub-admins";

interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  posterCount: number;
  createdAt: string;
}

interface Project {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  posterCount: number;
  createdAt: string;
}

type ReviewDecision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

interface PosterVersion {
  id: string;
  versionNumber: number;
  note: string;
  publishedAt: string;
  preview: string;
  contentType: ContentType;
  originalName: string;
  isCurrent: boolean;
  uploadedByName: string;
  uploadedByPosition: string | null;
  review: {
    decision: ReviewDecision;
    reviewerLabel: string;
    decidedAt: string;
    feedback: string[];
  } | null;
}

interface AdminPoster extends CategorizedWork {
  id: string;
  companyId: string;
  projectId: string;
  title: string;
  status: "DRAFT" | "AWAITING_CLIENT_REVIEW" | "REVISION_REQUIRED" | "APPROVED" | "ARCHIVED";
  createdAt: string;
  currentVersionNumber: number;
  versions: PosterVersion[];
}

interface SubAdmin {
  id: string;
  name: string;
  email: string;
  position: SubAdminPosition;
  createdAt: string;
}

type Message = { kind: "success" | "error"; text: string } | null;
type DateRange = "day" | "week" | "month" | "year" | "all";
type Panel =
  | { type: "create-company" }
  | { type: "create-sub-admin" }
  | { type: "edit-company" }
  | { type: "create-project" }
  | { type: "edit-project" }
  | { type: "upload"; posterId?: string }
  | { type: "compare"; posterId: string }
  | null;

const dateRanges: Array<{ value: DateRange; label: string }> = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
  { value: "all", label: "Overall" },
];

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

const reviewLabels: Record<ReviewDecision, string> = {
  APPROVE: "Approved",
  REQUEST_CHANGES: "Changes requested",
  REJECT: "Rejected",
};

const reviewClasses: Record<ReviewDecision, string> = {
  APPROVE: "approved",
  REQUEST_CHANGES: "changes",
  REJECT: "rejected",
};

function responseMessage(response: Response) {
  return response.json().catch(() => ({})).then((body: { message?: string }) => (
    body.message ?? `Request failed (${response.status}).`
  ));
}

function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function currentVersion(poster: AdminPoster | undefined) {
  return poster?.versions.find((version) => version.isCurrent) ?? poster?.versions[0];
}

function reviewPresentation(version: PosterVersion | undefined) {
  if (!version?.review) return { label: "Awaiting review", className: "pending", icon: Clock3 };
  const decision = version.review.decision;
  return {
    label: reviewLabels[decision],
    className: reviewClasses[decision],
    icon: decision === "APPROVE" ? CheckCircle2 : decision === "REJECT" ? XCircle : RotateCcw,
  };
}

function BrandMark() {
  return (
    <div className="admin-brand" aria-label="ClientLoop Admin">
      <Image src="/brand/app-icon.svg" width={40} height={40} alt="" priority />
      <div><strong>ClientLoop</strong><span>Admin workspace</span></div>
    </div>
  );
}

function ModalFrame({ title, eyebrow, onClose, children }: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
          <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function AdminDashboard({
  initialCompanies,
  initialProjects,
  initialPosters,
  initialSubAdmins,
  adminName,
  adminPosition,
  isSuperAdmin,
  posterStorageConfigured,
}: {
  initialCompanies: Company[];
  initialProjects: Project[];
  initialPosters: AdminPoster[];
  initialSubAdmins: SubAdmin[];
  adminName: string;
  adminPosition: string;
  isSuperAdmin: boolean;
  posterStorageConfigured: boolean;
}) {
  const initialCompanyId = initialCompanies[0]?.id ?? "";
  const initialProjectId = initialProjects.find((project) => project.companyId === initialCompanyId)?.id ?? "";
  const initialPoster = initialPosters.find((poster) => poster.projectId === initialProjectId);
  const [companies, setCompanies] = useState(initialCompanies);
  const [projects, setProjects] = useState(initialProjects);
  const [posters, setPosters] = useState(initialPosters);
  const [subAdmins, setSubAdmins] = useState(initialSubAdmins);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [selectedPosterId, setSelectedPosterId] = useState(initialPoster?.id ?? "");
  const [selectedVersionId, setSelectedVersionId] = useState(currentVersion(initialPoster)?.id ?? "");
  const [panel, setPanel] = useState<Panel>(initialCompanies.length || !isSuperAdmin ? null : { type: "create-company" });
  const [showPassword, setShowPassword] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [categoryFilter, setCategoryFilter] = useState(allCategories);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<RevisionCheck | null>(null);
  const [comparisonError, setComparisonError] = useState("");

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const companyProjects = useMemo(
    () => projects.filter((project) => project.companyId === selectedCompanyId),
    [projects, selectedCompanyId],
  );
  const selectedProject = companyProjects.find((project) => project.id === selectedProjectId);
  const filteredPosters = useMemo(
    () => posters.filter((poster) => isInDateRange(currentVersion(poster)?.publishedAt ?? poster.createdAt, dateRange) && matchesCategoryFilter(poster, categoryFilter)),
    [dateRange, posters, categoryFilter],
  );
  const projectPosters = useMemo(
    () => filteredPosters.filter((poster) => poster.projectId === selectedProjectId),
    [filteredPosters, selectedProjectId],
  );
  const selectedPoster = projectPosters.find((poster) => poster.id === selectedPosterId) ?? projectPosters[0];
  const selectedVersion = selectedPoster?.versions.find((version) => version.id === selectedVersionId)
    ?? currentVersion(selectedPoster);
  const uploadPosterTarget = panel?.type === "upload" && panel.posterId
    ? posters.find((poster) => poster.id === panel.posterId)
    : undefined;

  const projectStats = useMemo(() => {
    const decisions = projectPosters.map((poster) => currentVersion(poster)?.review?.decision);
    return {
      total: projectPosters.length,
      pending: decisions.filter((decision) => !decision).length,
      approved: decisions.filter((decision) => decision === "APPROVE").length,
      attention: decisions.filter((decision) => decision === "REQUEST_CHANGES" || decision === "REJECT").length,
    };
  }, [projectPosters]);

  const choosePoster = (poster: AdminPoster) => {
    setSelectedPosterId(poster.id);
    setSelectedVersionId(currentVersion(poster)?.id ?? "");
  };

  const chooseProject = (projectId: string) => {
    const firstPoster = posters.find((poster) => poster.projectId === projectId);
    setSelectedProjectId(projectId);
    setSelectedPosterId(firstPoster?.id ?? "");
    setSelectedVersionId(currentVersion(firstPoster)?.id ?? "");
    setMessage(null);
  };

  const chooseCompany = (companyId: string) => {
    const firstProject = projects.find((project) => project.companyId === companyId);
    const firstPoster = firstProject
      ? posters.find((poster) => poster.projectId === firstProject.id)
      : undefined;
    setSelectedCompanyId(companyId);
    setSelectedProjectId(firstProject?.id ?? "");
    setSelectedPosterId(firstPoster?.id ?? "");
    setSelectedVersionId(currentVersion(firstPoster)?.id ?? "");
    setMessage(null);
  };

  const signOut = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };

  const createCompany = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(formElement))),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const { company } = await response.json() as { company: Omit<Company, "posterCount" | "createdAt"> };
      const created = { ...company, posterCount: 0, createdAt: new Date().toISOString() };
      setCompanies((current) => [created, ...current]);
      setSelectedCompanyId(created.id);
      setSelectedProjectId("");
      setSelectedPosterId("");
      setPanel(null);
      setMessage({ kind: "success", text: `${created.name} was created. Add its first project from the sidebar.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Company could not be created." });
    } finally {
      setBusy(false);
    }
  };

  const createSubAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/sub-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(formElement))),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const { subAdmin } = await response.json() as { subAdmin: Omit<SubAdmin, "createdAt"> & { createdAt: string } };
      setSubAdmins((current) => [{ ...subAdmin, createdAt: new Date(subAdmin.createdAt).toISOString() }, ...current]);
      setPanel(null);
      setShowPassword(false);
      setMessage({ kind: "success", text: `${subAdmin.name} was added as a Sub Admin.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Sub Admin could not be created." });
    } finally {
      setBusy(false);
    }
  };

  const updateCompany = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompany) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/companies/${selectedCompany.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = await response.json() as {
        company: Pick<Company, "id" | "name" | "slug" | "email">;
        passwordUpdated: boolean;
      };
      setCompanies((current) => current.map((company) => company.id === result.company.id
        ? { ...company, ...result.company }
        : company));
      setPanel(null);
      setShowPassword(false);
      setMessage({
        kind: "success",
        text: result.passwordUpdated ? "Company details and password were updated." : "Company details were updated.",
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Company could not be updated." });
    } finally {
      setBusy(false);
    }
  };

  const deleteCompany = async () => {
    if (!selectedCompany || !window.confirm(`Delete ${selectedCompany.name}? Its login will be disabled and its history retained.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/companies/${selectedCompany.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response));
      const remainingCompanies = companies.filter((company) => company.id !== selectedCompany.id);
      const remainingProjects = projects.filter((project) => project.companyId !== selectedCompany.id);
      const remainingPosters = posters.filter((poster) => poster.companyId !== selectedCompany.id);
      const nextCompany = remainingCompanies[0];
      const nextProject = remainingProjects.find((project) => project.companyId === nextCompany?.id);
      const nextPoster = remainingPosters.find((poster) => poster.projectId === nextProject?.id);
      setCompanies(remainingCompanies);
      setProjects(remainingProjects);
      setPosters(remainingPosters);
      setSelectedCompanyId(nextCompany?.id ?? "");
      setSelectedProjectId(nextProject?.id ?? "");
      setSelectedPosterId(nextPoster?.id ?? "");
      setSelectedVersionId(currentVersion(nextPoster)?.id ?? "");
      setPanel(null);
      setMessage({ kind: "success", text: `${selectedCompany.name} was removed and its login disabled.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Company could not be deleted." });
    } finally {
      setBusy(false);
    }
  };

  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompany) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompany.id, name: form.get("name") }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const { project } = await response.json() as { project: Omit<Project, "posterCount" | "createdAt"> };
      const created = { ...project, posterCount: 0, createdAt: new Date().toISOString() };
      setProjects((current) => [created, ...current]);
      setSelectedProjectId(created.id);
      setSelectedPosterId("");
      setSelectedVersionId("");
      setPanel(null);
      setMessage({ kind: "success", text: `${created.name} was created. Upload its first poster.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Project could not be created." });
    } finally {
      setBusy(false);
    }
  };

  const updateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProject) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const { project } = await response.json() as { project: Pick<Project, "id" | "companyId" | "name" | "slug"> };
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, ...project } : item));
      setPanel(null);
      setMessage({ kind: "success", text: `${project.name} was updated.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Project could not be updated." });
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!selectedProject) return;
    if (selectedProject.posterCount) {
      setMessage({ kind: "error", text: `${selectedProject.name} contains posters and cannot be deleted.` });
      return;
    }
    if (!window.confirm(`Delete the empty project ${selectedProject.name}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/projects/${selectedProject.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response));
      const remaining = projects.filter((project) => project.id !== selectedProject.id);
      const nextProject = remaining.find((project) => project.companyId === selectedCompanyId);
      const nextPoster = posters.find((poster) => poster.projectId === nextProject?.id);
      setProjects(remaining);
      setSelectedProjectId(nextProject?.id ?? "");
      setSelectedPosterId(nextPoster?.id ?? "");
      setSelectedVersionId(currentVersion(nextPoster)?.id ?? "");
      setPanel(null);
      setMessage({ kind: "success", text: `${selectedProject.name} was deleted.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Project could not be deleted." });
    } finally {
      setBusy(false);
    }
  };

  const uploadPoster = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompany || !selectedProject) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const publishedAt = new Date(String(form.get("publishedAt") ?? ""));
    if (Number.isNaN(publishedAt.getTime())) {
      setMessage({ kind: "error", text: "Choose a valid publish date and time." });
      return;
    }
    if (publishedAt.getTime() > Date.now()) {
      setMessage({ kind: "error", text: "Publish date and time cannot be in the future." });
      return;
    }
    form.set("publishedAt", publishedAt.toISOString());
    form.set("companyId", selectedCompany.id);
    form.set("projectId", selectedProject.id);
    if (uploadPosterTarget) form.set("posterId", uploadPosterTarget.id);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/posters", { method: "POST", body: form });
      if (!response.ok) throw new Error(await responseMessage(response));
      const { poster } = await response.json() as {
        poster: {
          id: string;
          assetId: string;
          versionId: string;
          versionNumber: number;
          title: string;
          contentType: ContentType;
          originalName: string;
          publishedAt: string;
          uploadedByName: string;
          uploadedByPosition: string | null;
        } & CategorizedWork;
      };
      const note = String(form.get("note") ?? "");
      const version: PosterVersion = {
        id: poster.versionId,
        versionNumber: poster.versionNumber,
        note,
        publishedAt: poster.publishedAt,
        preview: `/api/v1/admin/assets/${poster.assetId}`,
        contentType: poster.contentType,
        originalName: poster.originalName,
        isCurrent: true,
        uploadedByName: poster.uploadedByName,
        uploadedByPosition: poster.uploadedByPosition,
        review: null,
      };

      if (uploadPosterTarget) {
        setPosters((current) => current.map((item) => item.id === uploadPosterTarget.id
          ? {
              ...item,
              category: poster.category,
              subcategory: poster.subcategory,
              status: "AWAITING_CLIENT_REVIEW",
              currentVersionNumber: version.versionNumber,
              versions: [version, ...item.versions.map((entry) => ({ ...entry, isCurrent: false }))],
            }
          : item));
        setSelectedPosterId(uploadPosterTarget.id);
        setSelectedVersionId(version.id);
        setMessage({ kind: "success", text: `Version ${version.versionNumber} was published for ${uploadPosterTarget.title}.` });
      } else {
        const created: AdminPoster = {
          id: poster.id,
          companyId: selectedCompany.id,
          projectId: selectedProject.id,
          title: poster.title,
          category: poster.category,
          subcategory: poster.subcategory,
          status: "AWAITING_CLIENT_REVIEW",
          createdAt: poster.publishedAt,
          currentVersionNumber: 1,
          versions: [version],
        };
        setPosters((current) => [created, ...current]);
        setCompanies((current) => current.map((company) => company.id === selectedCompany.id
          ? { ...company, posterCount: company.posterCount + 1 }
          : company));
        setProjects((current) => current.map((project) => project.id === selectedProject.id
          ? { ...project, posterCount: project.posterCount + 1 }
          : project));
        setSelectedPosterId(created.id);
        setSelectedVersionId(version.id);
        setMessage({ kind: "success", text: `${created.title} was published for review.` });
      }
      if (!matchesCategoryFilter(poster, categoryFilter)) setCategoryFilter(allCategories);
      setPanel(null);
      formElement.reset();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Poster could not be uploaded." });
    } finally {
      setBusy(false);
    }
  };

  const checkRevision = async (poster: AdminPoster) => {
    setPanel({ type: "compare", posterId: poster.id });
    setComparing(true);
    setComparison(null);
    setComparisonError("");
    try {
      const response = await fetch(`/api/v1/admin/posters/${poster.id}/compare`, { method: "POST" });
      if (!response.ok) throw new Error(await responseMessage(response));
      setComparison(await response.json() as RevisionCheck);
    } catch (error) {
      setComparisonError(error instanceof Error ? error.message : "The revision could not be checked.");
    } finally {
      setComparing(false);
    }
  };

  const deletePoster = async () => {
    if (!selectedPoster || !window.confirm(
      `Permanently delete ${selectedPoster.title} and all ${selectedPoster.versions.length} version${selectedPoster.versions.length === 1 ? "" : "s"}? This cannot be undone.`,
    )) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/posters/${selectedPoster.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response));
      const { cleanupPending } = await response.json() as { cleanupPending: number };
      const remaining = posters.filter((poster) => poster.id !== selectedPoster.id);
      const nextPoster = remaining.find((poster) => poster.projectId === selectedProjectId);
      setPosters(remaining);
      setCompanies((current) => current.map((company) => company.id === selectedPoster.companyId
        ? { ...company, posterCount: Math.max(0, company.posterCount - 1) }
        : company));
      setProjects((current) => current.map((project) => project.id === selectedPoster.projectId
        ? { ...project, posterCount: Math.max(0, project.posterCount - 1) }
        : project));
      setSelectedPosterId(nextPoster?.id ?? "");
      setSelectedVersionId(currentVersion(nextPoster)?.id ?? "");
      setMessage({
        kind: cleanupPending ? "error" : "success",
        text: cleanupPending
          ? `${selectedPoster.title} was deleted, but ${cleanupPending} stored file${cleanupPending === 1 ? "" : "s"} still require server cleanup.`
          : `${selectedPoster.title} and all of its versions were permanently deleted.`,
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Poster could not be deleted." });
    } finally {
      setBusy(false);
    }
  };

  const deletePosterVersion = async (version: PosterVersion) => {
    if (!selectedPoster) return;
    if (selectedPoster.versions.length === 1) {
      await deletePoster();
      return;
    }
    if (!window.confirm(`Permanently delete ${selectedPoster.title} version ${version.versionNumber}? This cannot be undone.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/posters/${selectedPoster.id}/versions/${version.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = await response.json() as {
        version: { id: string; versionNumber: number; currentVersionId: string };
        cleanupPending: number;
      };
      const remainingVersions = selectedPoster.versions
        .filter((item) => item.id !== result.version.id)
        .map((item) => ({ ...item, isCurrent: item.id === result.version.currentVersionId }));
      const replacement = remainingVersions.find(({ isCurrent }) => isCurrent) ?? remainingVersions[0];
      const nextStatus = replacement?.review?.decision === "APPROVE"
        ? "APPROVED" as const
        : replacement?.review
          ? "REVISION_REQUIRED" as const
          : "AWAITING_CLIENT_REVIEW" as const;
      setPosters((current) => current.map((poster) => poster.id === selectedPoster.id
        ? {
            ...poster,
            versions: remainingVersions,
            currentVersionNumber: replacement?.versionNumber ?? 0,
            status: version.isCurrent ? nextStatus : poster.status,
          }
        : poster));
      setSelectedVersionId(replacement?.id ?? "");
      setMessage({
        kind: result.cleanupPending ? "error" : "success",
        text: result.cleanupPending
          ? `Version ${result.version.versionNumber} was deleted, but ${result.cleanupPending} stored file${result.cleanupPending === 1 ? "" : "s"} still require server cleanup.`
          : `Version ${result.version.versionNumber} of ${selectedPoster.title} was permanently deleted.`,
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Poster version could not be deleted." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-workspace-shell">
      <aside className="admin-workspace-sidebar">
        <BrandMark />
        <div className="admin-sidebar-scroll">
          <div className="admin-sidebar-heading">
            <span>Companies <em>{companies.length}</em></span>
            {isSuperAdmin ? <button type="button" onClick={() => setPanel({ type: "create-company" })} aria-label="Add company"><Plus size={16} /></button> : null}
          </div>
          <label className="admin-range-filter">
            <Clock3 size={15} />
            <span>Period</span>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)} aria-label="Filter activity period">
              {dateRanges.map((range) => <option value={range.value} key={range.value}>{range.label}</option>)}
            </select>
          </label>
          <nav className="admin-company-nav" aria-label="Companies">
            {companies.map((company) => (
              <button className={company.id === selectedCompanyId ? "active" : ""} type="button" key={company.id} onClick={() => chooseCompany(company.id)}>
                <span className="admin-company-avatar">{company.name.slice(0, 1).toUpperCase()}</span>
                <span><strong>{company.name}</strong><small>{filteredPosters.filter((poster) => poster.companyId === company.id).length} posters</small></span>
                <ChevronRight size={16} />
              </button>
            ))}
          </nav>

          {selectedCompany ? (
            <div className="admin-project-nav-wrap">
              <div className="admin-sidebar-heading">
                <span>Projects <em>{companyProjects.length}</em></span>
                <button type="button" onClick={() => setPanel({ type: "create-project" })} aria-label="Add project"><FolderPlus size={16} /></button>
              </div>
              <nav className="admin-project-nav" aria-label={`${selectedCompany.name} projects`}>
                {companyProjects.map((project) => (
                  <button className={project.id === selectedProjectId ? "active" : ""} type="button" key={project.id} onClick={() => chooseProject(project.id)}>
                    <FolderKanban size={17} />
                    <span><strong>{project.name}</strong><small>{filteredPosters.filter((poster) => poster.projectId === project.id).length} posters</small></span>
                  </button>
                ))}
                {!companyProjects.length ? <p>No projects yet</p> : null}
              </nav>
            </div>
          ) : null}

          {isSuperAdmin ? (
            <div className="admin-project-nav-wrap">
              <div className="admin-sidebar-heading">
                <span>Admin team <em>{subAdmins.length}</em></span>
                <button type="button" onClick={() => setPanel({ type: "create-sub-admin" })} aria-label="Add Sub Admin"><UserPlus size={16} /></button>
              </div>
              <div className="admin-team-list">
                {subAdmins.map((subAdmin) => (
                  <div key={subAdmin.id}>
                    <span className="admin-company-avatar">{subAdmin.name.slice(0, 1).toUpperCase()}</span>
                    <span><strong>{subAdmin.name}</strong><small>{subAdmin.position}</small></span>
                  </div>
                ))}
                {!subAdmins.length ? <p>No Sub Admins yet</p> : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="admin-sidebar-account">
          <span className="admin-user-avatar">{adminName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{adminName}</strong><small>{adminPosition}</small></span>
          <button type="button" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="admin-workspace-main">
        <header className="admin-workspace-topbar">
          <div className="admin-breadcrumb">
            <span>Workspace</span>
            {selectedCompany ? <><ChevronRight size={14} /><strong>{selectedCompany.name}</strong></> : null}
            {selectedProject ? <><ChevronRight size={14} /><strong>{selectedProject.name}</strong></> : null}
          </div>
          {selectedCompany && isSuperAdmin ? (
            <Link className="admin-subtle-button" href={`/messages?companyId=${selectedCompany.id}`}><MessageSquareText size={16} />Messages</Link>
          ) : null}
          {selectedCompany ? (
            <button className="admin-subtle-button" type="button" onClick={() => setPanel({ type: "edit-company" })}>
              <Settings2 size={16} />Company settings
            </button>
          ) : null}
          <button className="admin-mobile-signout" type="button" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button>
        </header>

        <div className="admin-workspace-content">
          {message ? (
            <div className={`admin-message ${message.kind}`} role="status">
              {message.kind === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>{message.text}</span>
              <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss"><X size={16} /></button>
            </div>
          ) : null}

          {!selectedCompany ? (
            <section className="admin-empty-workspace">
              <span><Building2 size={30} /></span>
              <h1>{isSuperAdmin ? "Create your first company" : "No companies available"}</h1>
              <p>{isSuperAdmin ? "Companies, projects, posters, client decisions, and version history will all be managed here." : "Ask the Super Admin to add a company. You can manage its projects and posters after it is created."}</p>
              {isSuperAdmin ? <button className="admin-primary-button" type="button" onClick={() => setPanel({ type: "create-company" })}><Plus size={18} />Add company</button> : null}
            </section>
          ) : !selectedProject ? (
            <section className="admin-empty-workspace">
              <span><FolderPlus size={30} /></span>
              <p className="eyebrow">{selectedCompany.name}</p>
              <h1>Add the first project</h1>
              <p>Projects keep each company’s posters and their review history organized.</p>
              <button className="admin-primary-button" type="button" onClick={() => setPanel({ type: "create-project" })}><FolderPlus size={18} />New project</button>
            </section>
          ) : (
            <>
              <section className="admin-project-header">
                <div>
                  <p className="eyebrow">{selectedCompany.name} / Project</p>
                  <h1>{selectedProject.name}</h1>
                  <p>Track every poster, client response, suggestion, and revision in one place · {dateRanges.find((range) => range.value === dateRange)?.label}.</p>
                </div>
                <div className="admin-header-actions">
                  <button className="admin-subtle-button" type="button" onClick={() => setPanel({ type: "edit-project" })}><Pencil size={16} />Edit project</button>
                  <button className="admin-primary-button" type="button" onClick={() => setPanel({ type: "upload" })}><ImagePlus size={18} />New poster</button>
                </div>
              </section>

              <CategoryFilters value={categoryFilter} onChange={setCategoryFilter} />
              <section className="admin-stat-grid" aria-label="Project review summary">
                <div><span className="stat-icon neutral"><FileImage size={19} /></span><p><strong>{projectStats.total}</strong><small>Total posters</small></p></div>
                <div><span className="stat-icon pending"><Clock3 size={19} /></span><p><strong>{projectStats.pending}</strong><small>Awaiting review</small></p></div>
                <div><span className="stat-icon approved"><Check size={19} /></span><p><strong>{projectStats.approved}</strong><small>Approved</small></p></div>
                <div><span className="stat-icon changes"><MessageSquareText size={19} /></span><p><strong>{projectStats.attention}</strong><small>Need attention</small></p></div>
              </section>

              {projectPosters.length ? (
                <div className="admin-project-layout">
                  <section className="admin-poster-section">
                    <div className="admin-section-heading"><div><p className="eyebrow">Project feed</p><h2>Posters</h2></div><span>{projectPosters.length} items</span></div>
                    <div className="admin-poster-grid">
                      {projectPosters.map((poster) => {
                        const version = currentVersion(poster);
                        const status = reviewPresentation(version);
                        const StatusIcon = status.icon;
                        return (
                          <article className={poster.id === selectedPoster?.id ? "admin-poster-tile selected" : "admin-poster-tile"} key={poster.id}>
                            <button className="admin-poster-select" type="button" onClick={() => choosePoster(poster)} aria-label={`Open ${poster.title}`}>
                              <span className="admin-poster-image">
                                {version ? <AssetPreview src={version.preview} title={`${poster.title} version ${version.versionNumber}`} contentType={version.contentType} compact /> : <FileImage size={30} />}
                                <span className={`admin-status-pill ${status.className}`}><StatusIcon size={13} />{status.label}</span>
                              </span>
                              <span className="admin-poster-meta">
                                <span><strong>{poster.title}</strong><small>Version {poster.currentVersionNumber}</small><small>{workClassificationLabel(poster)}</small></span>
                                <ChevronRight size={17} />
                              </span>
                            </button>
                            <button className="admin-new-version-link" type="button" onClick={() => setPanel({ type: "upload", posterId: poster.id })}>
                              <Upload size={14} />Upload new version
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <aside className="admin-poster-inspector">
                    {selectedPoster && selectedVersion ? (
                      <>
                        <header>
                          <div><p className="eyebrow">Poster details</p><h2>{selectedPoster.title}</h2></div>
                          <div className="admin-header-actions">
                            <button className="admin-icon-button" type="button" disabled={busy} onClick={() => setPanel({ type: "upload", posterId: selectedPoster.id })} aria-label="Upload new version"><Upload size={18} /></button>
                            <button className="admin-icon-button danger" type="button" disabled={busy} onClick={() => void deletePoster()} aria-label={`Delete entire poster ${selectedPoster.title}`} title="Delete entire poster"><Trash2 size={18} /></button>
                          </div>
                        </header>
                        <div className="admin-inspector-preview"><AssetPreview src={selectedVersion.preview} title={`${selectedPoster.title} version ${selectedVersion.versionNumber}`} contentType={selectedVersion.contentType} originalName={selectedVersion.originalName} /></div>
                        <p className="work-classification">{workClassificationLabel(selectedPoster)}</p>
                        <div className="admin-version-summary">
                          <div><span>Version</span><strong>v{selectedVersion.versionNumber}{selectedVersion.isCurrent ? " · Current" : ""}</strong></div>
                          <div><span>Published</span><strong>{formatDate(selectedVersion.publishedAt)}</strong></div>
                          <div><span>Uploaded by</span><strong>{selectedVersion.uploadedByName}</strong><small>{selectedVersion.uploadedByPosition}</small></div>
                        </div>
                        {(() => {
                          const status = reviewPresentation(selectedVersion);
                          const StatusIcon = status.icon;
                          return (
                            <section className={`admin-review-panel ${status.className}`}>
                              <div className="admin-review-title"><span><StatusIcon size={18} /></span><div><small>Client response</small><strong>{status.label}</strong></div></div>
                              {selectedVersion.review ? (
                                <>
                                  <p className="admin-reviewer">By {selectedVersion.review.reviewerLabel} · {formatDate(selectedVersion.review.decidedAt, true)}</p>
                                  {selectedVersion.review.feedback.length ? selectedVersion.review.feedback.map((feedback) => (
                                    <blockquote key={feedback}><MessageSquareText size={16} /><p>{feedback}</p></blockquote>
                                  )) : <p className="admin-no-feedback">No written suggestion was added.</p>}
                                </>
                              ) : <p className="admin-no-feedback">The client has not reviewed this version yet.</p>}
                            </section>
                          );
                        })()}
                        {selectedVersion.note ? <section className="admin-team-note"><small>Upload note</small><p>{selectedVersion.note}</p></section> : null}
                        {selectedVersion.isCurrent && selectedPoster.status === "AWAITING_CLIENT_REVIEW" && selectedPoster.versions.length > 1 ? <button className="revision-check-button" type="button" onClick={() => void checkRevision(selectedPoster)}><GitCompareArrows size={17} />Check requested changes</button> : null}
                        <div className="admin-history-heading"><h3>Version history</h3><span>{selectedPoster.versions.length} versions</span></div>
                        <div className="admin-version-list">
                          {selectedPoster.versions.map((version) => {
                            const status = reviewPresentation(version);
                            return (
                              <div className="admin-version-row" key={version.id}>
                                <button className={`admin-version-select${version.id === selectedVersion.id ? " active" : ""}`} type="button" onClick={() => setSelectedVersionId(version.id)}>
                                  <span className="admin-version-thumb"><AssetPreview src={version.preview} title="" contentType={version.contentType} compact /></span>
                                  <span><strong>Version {version.versionNumber}</strong><small>{formatDate(version.publishedAt)} · {status.label}</small></span>
                                  <small className="admin-version-uploader">{version.uploadedByName}{version.uploadedByPosition ? ` · ${version.uploadedByPosition}` : ""}</small>
                                  {version.isCurrent ? <em>Current</em> : <ChevronRight size={15} />}
                                </button>
                                <button className="admin-version-delete" type="button" disabled={busy} onClick={() => void deletePosterVersion(version)} aria-label={`Delete version ${version.versionNumber}`} title={`Delete version ${version.versionNumber}`}><Trash2 size={15} /></button>
                              </div>
                            );
                          })}
                        </div>
                        <a className="admin-download-link" href={assetActionHref(selectedVersion.preview, selectedVersion.contentType)} target={selectedVersion.contentType === "website" ? "_blank" : undefined} rel={selectedVersion.contentType === "website" ? "noopener noreferrer" : undefined}>{selectedVersion.contentType === "website" ? <ExternalLink size={16} /> : <Download size={16} />}{selectedVersion.contentType === "website" ? "Open website" : "Download this version"}</a>
                      </>
                    ) : null}
                  </aside>
                </div>
              ) : (
                <section className="admin-empty-posters">
                  <span><ImagePlus size={29} /></span>
                  <h2>No posters in this project</h2>
                  <p>{selectedProject.posterCount ? "No posters match the selected period, category, and subcategory." : "Upload a standalone poster now. Later revisions stay attached to that same poster."}</p>
                  <button className="admin-primary-button" type="button" onClick={() => setPanel({ type: "upload" })}><Upload size={18} />Upload first poster</button>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      {panel?.type === "create-company" && isSuperAdmin ? (
        <ModalFrame eyebrow="Company access" title="Add company" onClose={() => companies.length ? setPanel(null) : undefined}>
          <form className="admin-modal-form" onSubmit={createCompany}>
            <label>Company name<input name="name" minLength={2} maxLength={180} placeholder="e.g. Acme Foods" autoFocus required /></label>
            <label>Login email<input name="email" type="email" maxLength={320} placeholder="client@company.com" required /></label>
            <label>Temporary password<div className="admin-password-field"><input name="password" type={showPassword ? "text" : "password"} minLength={12} maxLength={128} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><small>Use at least 12 characters.</small></label>
            <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create company"}</button>
          </form>
        </ModalFrame>
      ) : null}

      {panel?.type === "create-sub-admin" && isSuperAdmin ? (
        <ModalFrame eyebrow="Admin team" title="Add Sub Admin" onClose={() => setPanel(null)}>
          <form className="admin-modal-form" onSubmit={createSubAdmin}>
            <label>Sub Admin name<input name="name" minLength={2} maxLength={160} placeholder="e.g. Fathima Ali" autoFocus required /></label>
            <label>Working position<select name="position" defaultValue="Developer" required>{subAdminPositions.map((position) => <option value={position} key={position}>{position}</option>)}</select></label>
            <label>Login email<input name="email" type="email" maxLength={320} placeholder="team@company.com" required /></label>
            <label>Temporary password<div className="admin-password-field"><input name="password" type={showPassword ? "text" : "password"} minLength={12} maxLength={128} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><small>Use at least 12 characters.</small></label>
            <p className="admin-form-help">Sub Admins can manage projects, posters, versions, and messages. They cannot add or change company accounts.</p>
            <button className="admin-primary-button" type="submit" disabled={busy}><UserPlus size={17} />{busy ? "Creating…" : "Create Sub Admin"}</button>
          </form>
        </ModalFrame>
      ) : null}

      {panel?.type === "edit-company" && selectedCompany ? (
        <ModalFrame eyebrow="Company settings" title={`Edit ${selectedCompany.name}`} onClose={() => setPanel(null)}>
          <form className="admin-modal-form" onSubmit={updateCompany}>
            <label>Company name<input name="name" minLength={2} maxLength={180} defaultValue={selectedCompany.name} required /></label>
            <label>Login email<input name="email" type="email" maxLength={320} defaultValue={selectedCompany.email} required /></label>
            <label>New password <small>Optional</small><div className="admin-password-field"><input name="password" type={showPassword ? "text" : "password"} minLength={12} maxLength={128} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <div className="admin-modal-actions"><button className="admin-danger-button" type="button" disabled={busy} onClick={deleteCompany}><Trash2 size={16} />Delete company</button><button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
          </form>
        </ModalFrame>
      ) : null}

      {panel?.type === "create-project" && selectedCompany ? (
        <ModalFrame eyebrow={selectedCompany.name} title="New project" onClose={() => setPanel(null)}>
          <form className="admin-modal-form" onSubmit={createProject}>
            <label>Project name<input name="name" minLength={2} maxLength={100} placeholder="e.g. Onam campaign" autoFocus required /></label>
            <p className="admin-form-help">New posters and their versions will be grouped under this project.</p>
            <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
          </form>
        </ModalFrame>
      ) : null}

      {panel?.type === "edit-project" && selectedProject ? (
        <ModalFrame eyebrow="Project settings" title={`Edit ${selectedProject.name}`} onClose={() => setPanel(null)}>
          <form className="admin-modal-form" onSubmit={updateProject}>
            <label>Project name<input name="name" minLength={2} maxLength={100} defaultValue={selectedProject.name} autoFocus required /></label>
            <div className="admin-modal-actions"><button className="admin-danger-button" type="button" disabled={busy || Boolean(selectedProject.posterCount)} onClick={deleteProject}><Trash2 size={16} />Delete project</button><button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save project"}</button></div>
            {selectedProject.posterCount ? <p className="admin-form-help">Projects containing posters cannot be deleted.</p> : null}
          </form>
        </ModalFrame>
      ) : null}

      {panel?.type === "upload" && selectedCompany && selectedProject ? (
        <ModalFrame
          eyebrow={`${selectedCompany.name} / ${selectedProject.name}`}
          title={uploadPosterTarget ? `Upload version ${uploadPosterTarget.currentVersionNumber + 1}` : "Add new content"}
          onClose={() => setPanel(null)}
        >
          <form className="admin-modal-form" onSubmit={uploadPoster}>
            {uploadPosterTarget ? (
              <div className="admin-version-target"><RotateCcw size={19} /><div><small>New version of</small><strong>{uploadPosterTarget.title}</strong></div></div>
            ) : (
              <label>Title<CorrectableInput name="title" maxLength={220} placeholder="Give this item a clear name" autoFocus required context="title" disabled={busy} /></label>
            )}
            <label>Upload note<CorrectableTextarea name="note" maxLength={3000} rows={3} placeholder={uploadPosterTarget ? "What changed in this version?" : "Optional context for the client"} context="upload-note" disabled={busy} /></label>
            <label>Publish date and time<input name="publishedAt" type="datetime-local" defaultValue={localDateTimeValue(new Date())} max={localDateTimeValue(new Date())} required disabled={busy} /><small>Defaults to now. Past dates are allowed; future dates are not.</small></label>
            <UploadCategoryFields key={`category-${uploadPosterTarget?.id ?? "new"}`} initialValue={uploadPosterTarget} disabled={busy} />
            <UploadContentFields key={uploadPosterTarget?.id ?? "new"} initialType={currentVersion(uploadPosterTarget)?.contentType} disabled={busy} />
            {message?.kind === "error" ? <p className="upload-error" role="alert">{message.text}</p> : null}
            {!posterStorageConfigured ? <p className="storage-warning">Poster storage is not configured. Add UPLOAD_ROOT before uploading.</p> : null}
            <button className="admin-primary-button" type="submit" disabled={busy || !posterStorageConfigured}><Upload size={18} />{busy ? "Publishing…" : uploadPosterTarget ? "Publish new version" : "Publish content"}</button>
            <p className="admin-form-help">{uploadPosterTarget ? "This keeps all earlier versions and client feedback in the history." : "Add a file or website link for review. Use Upload new version when revising an existing item."}</p>
          </form>
        </ModalFrame>
      ) : null}

      {panel?.type === "compare" ? (
        <ModalFrame eyebrow="Revision quality check" title={posters.find((poster) => poster.id === panel.posterId)?.title ?? "Check revision"} onClose={() => setPanel(null)}>
          <div className="revision-check-result" aria-live="polite">
            {comparing ? <div className="revision-check-loading"><span className="revision-check-spinner"><GitCompareArrows size={22} /></span><strong>Checking every client request…</strong><p>Comparing both stored versions and looking for anything missing.</p></div> : comparisonError ? <div className="revision-check-error" role="alert"><XCircle size={20} /><div><strong>Could not complete the check</strong><p>{comparisonError}</p></div></div> : comparison ? <>
              <div className={`revision-verdict ${comparison.verdict.toLowerCase().replace("_", "-")}`}>
                {comparison.verdict === "READY" ? <CheckCircle2 size={22} /> : comparison.verdict === "NEEDS_ATTENTION" ? <XCircle size={22} /> : <Clock3 size={22} />}
                <div><small>Compared v{comparison.compared.fromVersion} with v{comparison.compared.toVersion}</small><strong>{comparison.verdict === "READY" ? "All requested changes found" : comparison.verdict === "NEEDS_ATTENTION" ? "Some changes need attention" : "Manual review still needed"}</strong></div>
              </div>
              <p className="revision-summary">{comparison.summary}</p>
              <div className="revision-requirements">{comparison.requirements.map((requirement, index) => <article className={requirement.status.toLowerCase()} key={`${requirement.request}:${index}`}>
                <span>{requirement.status === "MET" ? <Check size={15} /> : requirement.status === "MISSING" ? <X size={15} /> : <Clock3 size={15} />}</span>
                <div><strong>{requirement.request}</strong><p>{requirement.evidence}</p></div>
              </article>)}</div>
              {comparison.visualChanges.length ? <section className="revision-detail-list"><strong>Other detected changes</strong><ul>{comparison.visualChanges.map((change) => <li key={change}>{change}</li>)}</ul></section> : null}
              {comparison.warnings.length ? <section className="revision-detail-list warnings"><strong>Review notes</strong><ul>{comparison.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
              <p className="revision-disclaimer">This is a rule-based QA check; approve the final design after a human review.</p>
            </> : null}
          </div>
        </ModalFrame>
      ) : null}
    </div>
  );
}
