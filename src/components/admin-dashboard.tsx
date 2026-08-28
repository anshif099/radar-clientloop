"use client";

import {
  Building2,
  FolderKanban,
  FolderPlus,
  Eye,
  EyeOff,
  ImagePlus,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { authClient } from "@/auth/client";

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

type Message = { kind: "success" | "error"; text: string } | null;

async function responseMessage(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  return body.message ?? `Request failed (${response.status}).`;
}

export function AdminDashboard({
  initialCompanies,
  initialProjects,
  adminName,
  posterStorageConfigured,
}: {
  initialCompanies: Company[];
  initialProjects: Project[];
  adminName: string;
  posterStorageConfigured: boolean;
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [projects, setProjects] = useState(initialProjects);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showCompanyForm, setShowCompanyForm] = useState(!initialCompanies.length);
  const [editingCompany, setEditingCompany] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [projectBusy, setProjectBusy] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const selectedProjects = projects.filter((project) => project.companyId === selectedCompanyId);
  const selectedProject = selectedProjects.find((project) => project.id === selectedProjectId);

  const selectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedProjectId("");
    setEditingCompany(false);
    setShowEditPassword(false);
    setShowCompanyForm(false);
    setMessage(null);
  };

  const createCompany = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCompanyBusy(true);
    setMessage(null);

    try {
      const form = new FormData(formElement);
      const response = await fetch("/api/v1/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      if (!response.ok) throw new Error(await responseMessage(response));

      const { company } = await response.json() as {
        company: Omit<Company, "posterCount" | "createdAt">;
      };
      const created = { ...company, posterCount: 0, createdAt: new Date().toISOString() };
      setCompanies((current) => [created, ...current]);
      setSelectedCompanyId(company.id);
      setSelectedProjectId("");
      setShowCompanyForm(false);
      formElement.reset();
      setMessage({ kind: "success", text: `${company.name} was created. Now add its first project.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Company could not be created." });
    } finally {
      setCompanyBusy(false);
    }
  };

  const updateSelectedCompany = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompany) return;
    setCompanyBusy(true);
    setMessage(null);

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(`/api/v1/admin/companies/${selectedCompany.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      if (!response.ok) throw new Error(await responseMessage(response));

      const { company, passwordUpdated } = await response.json() as {
        company: Pick<Company, "id" | "name" | "slug" | "email">;
        passwordUpdated: boolean;
      };
      setCompanies((current) => current.map((item) => item.id === company.id ? { ...item, ...company } : item));
      setEditingCompany(false);
      setShowEditPassword(false);
      setMessage({
        kind: "success",
        text: passwordUpdated
          ? `${company.name} was updated and the new password was saved.`
          : `${company.name} was updated.`,
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Company could not be updated." });
    } finally {
      setCompanyBusy(false);
    }
  };

  const deleteSelectedCompany = async (company: Company) => {
    const confirmed = window.confirm(
      `Delete ${company.name}? Its login will be disabled and it will be removed from this list. Existing history is retained for safety.`,
    );
    if (!confirmed) return;

    setCompanyBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/companies/${company.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response));

      setCompanies((current) => current.filter((item) => item.id !== company.id));
      setProjects((current) => current.filter((project) => project.companyId !== company.id));
      if (selectedCompanyId === company.id) {
        setSelectedCompanyId("");
        setSelectedProjectId("");
        setEditingCompany(false);
      }
      setMessage({ kind: "success", text: `${company.name} was deleted and its login was disabled.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Company could not be deleted." });
    } finally {
      setCompanyBusy(false);
    }
  };

  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompany) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setProjectBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompany.id, name: form.get("name") }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));

      const { project } = await response.json() as {
        project: Omit<Project, "posterCount" | "createdAt">;
      };
      const created = { ...project, posterCount: 0, createdAt: new Date().toISOString() };
      setProjects((current) => [created, ...current]);
      setSelectedProjectId(project.id);
      formElement.reset();
      setMessage({ kind: "success", text: `${project.name} was added. You can now add posters to it.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Project could not be created." });
    } finally {
      setProjectBusy(false);
    }
  };

  const uploadPoster = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompany || !selectedProject) return;
    const formElement = event.currentTarget;
    setPosterBusy(true);
    setMessage(null);

    try {
      const form = new FormData(formElement);
      form.set("companyId", selectedCompany.id);
      form.set("projectId", selectedProject.id);
      const response = await fetch("/api/v1/admin/posters", { method: "POST", body: form });
      if (!response.ok) throw new Error(await responseMessage(response));

      setCompanies((current) => current.map((company) => (
        company.id === selectedCompany.id ? { ...company, posterCount: company.posterCount + 1 } : company
      )));
      setProjects((current) => current.map((project) => (
        project.id === selectedProject.id ? { ...project, posterCount: project.posterCount + 1 } : project
      )));
      formElement.reset();
      setMessage({ kind: "success", text: `Poster published under ${selectedProject.name}.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Poster could not be uploaded." });
    } finally {
      setPosterBusy(false);
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="auth-brand">
          <Image src="/brand/app-icon.svg" width={42} height={42} alt="" priority />
          <div><strong>ClientLoop</strong><span>Super Admin</span></div>
        </div>
        <div className="admin-account">
          <span>{adminName}</span>
          <button className="secondary-button" type="button" onClick={signOut}><LogOut size={17} />Sign out</button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-intro">
          <p className="eyebrow">Platform control</p>
          <h1>Companies, projects and posters</h1>
          <p>Select a company first, create a project under it, then add posters to that project.</p>
        </section>

        {message ? <p className={`form-alert ${message.kind === "error" ? "error-alert" : "success-alert"}`} role="status">{message.text}</p> : null}

        <section className="admin-card company-manager">
          <div className="card-heading">
            <span className="admin-icon"><Building2 size={21} /></span>
            <div><p className="step-label">Step 1</p><h2>Select company</h2><p>Choose the company you want to manage.</p></div>
          </div>

          <div className="company-select-row">
            <label className="admin-select-label">
              Company
              <select value={selectedCompanyId} onChange={(event) => selectCompany(event.target.value)}>
                <option value="">Select a company</option>
                {companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}
              </select>
            </label>
            <button className="secondary-button" type="button" onClick={() => { setShowCompanyForm(true); setEditingCompany(false); }}>
              <Plus size={17} />Add company
            </button>
          </div>

          {selectedCompany ? (
            <div className="selected-company-panel">
              <div>
                <strong>{selectedCompany.name}</strong>
                <span>{selectedCompany.email}</span>
                <small>{selectedProjects.length} projects · {selectedCompany.posterCount} posters</small>
              </div>
              <div className="row-actions">
                <button className="secondary-button compact-button" type="button" onClick={() => { setEditingCompany(true); setShowEditPassword(false); setShowCompanyForm(false); }}><Pencil size={15} />Edit</button>
                <button className="danger-button compact-button" type="button" disabled={companyBusy} onClick={() => deleteSelectedCompany(selectedCompany)}><Trash2 size={15} />Delete</button>
              </div>
            </div>
          ) : null}

          {editingCompany && selectedCompany ? (
            <form className="stack-form embedded-form" key={selectedCompany.id} onSubmit={updateSelectedCompany}>
              <div className="form-section-heading"><strong>Edit company</strong><button type="button" onClick={() => setEditingCompany(false)}>Cancel</button></div>
              <label>Company name<input name="name" minLength={2} maxLength={180} defaultValue={selectedCompany.name} required /></label>
              <label>Company login email<input name="email" type="email" defaultValue={selectedCompany.email} required /></label>
              <label>
                New password (optional)
                <div className="password-field">
                  <input name="password" type={showEditPassword ? "text" : "password"} minLength={12} maxLength={128} autoComplete="new-password" placeholder="Leave blank to keep current password" />
                  <button type="button" onClick={() => setShowEditPassword((current) => !current)} aria-label={showEditPassword ? "Hide new password" : "Show new password"}>{showEditPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                </div>
                <small>Current passwords cannot be displayed. Enter at least 12 characters only when replacing it.</small>
              </label>
              <button className="primary-button" type="submit" disabled={companyBusy}><Pencil size={17} />{companyBusy ? "Saving…" : "Save changes"}</button>
            </form>
          ) : null}

          {showCompanyForm ? (
            <form className="stack-form embedded-form" onSubmit={createCompany}>
              <div className="form-section-heading"><strong>Add new company</strong>{companies.length ? <button type="button" onClick={() => setShowCompanyForm(false)}>Cancel</button> : null}</div>
              <label>Company name<input name="name" minLength={2} maxLength={180} required /></label>
              <label>Company login email<input name="email" type="email" autoComplete="off" required /></label>
              <label>Initial password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /><small>At least 12 characters. Share it securely with the company.</small></label>
              <button className="primary-button" type="submit" disabled={companyBusy}><Building2 size={18} />{companyBusy ? "Creating…" : "Create company"}</button>
            </form>
          ) : null}
        </section>

        {selectedCompany ? (
          <div className="admin-grid workflow-grid">
            <section className="admin-card">
              <div className="card-heading">
                <span className="admin-icon"><FolderPlus size={21} /></span>
                <div><p className="step-label">Step 2</p><h2>Add project</h2><p>Create projects under {selectedCompany.name}.</p></div>
              </div>
              <form className="stack-form" onSubmit={createProject}>
                <label>Project name<input name="name" minLength={2} maxLength={100} placeholder="e.g. Onam campaign" required /></label>
                <button className="primary-button" type="submit" disabled={projectBusy}><FolderPlus size={18} />{projectBusy ? "Adding…" : "Add project"}</button>
              </form>

              <div className="project-list">
                <p>Projects for {selectedCompany.name}</p>
                {selectedProjects.length ? selectedProjects.map((project) => (
                  <button className={selectedProjectId === project.id ? "project-option active" : "project-option"} type="button" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                    <span><FolderKanban size={17} /><strong>{project.name}</strong></span><small>{project.posterCount} posters</small>
                  </button>
                )) : <div className="empty-projects"><FolderKanban size={24} /><span>No projects yet. Add the first one above.</span></div>}
              </div>
            </section>

            <section className="admin-card">
              <div className="card-heading">
                <span className="admin-icon"><ImagePlus size={21} /></span>
                <div><p className="step-label">Step 3</p><h2>Add poster</h2><p>The poster will be placed under the selected project.</p></div>
              </div>
              <form className="stack-form" onSubmit={uploadPoster}>
                <label>Company<input value={selectedCompany.name} readOnly aria-readonly="true" /></label>
                <label>Project<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} required><option value="">Select a project</option>{selectedProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
                <label>Poster title<input name="title" maxLength={220} required /></label>
                <label>Note<textarea name="note" maxLength={3000} rows={3} /></label>
                <label className="file-input">Poster image<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /><small>JPG, PNG, WebP, or GIF · maximum 20 MB</small></label>
                {!posterStorageConfigured ? <p className="storage-warning" role="note">Poster storage is not configured. Add the S3 environment settings before uploading.</p> : null}
                <button className="primary-button" type="submit" disabled={posterBusy || !selectedProject || !posterStorageConfigured}><Upload size={18} />{posterBusy ? "Uploading…" : "Publish poster"}</button>
              </form>
            </section>
          </div>
        ) : (
          <section className="company-section empty-workflow">
            <Building2 size={30} />
            <h2>Select a company to continue</h2>
            <p>Projects and poster uploads will appear here after you choose a company.</p>
          </section>
        )}

        <section className="company-section">
          <div className="section-title"><div><p className="eyebrow">Tenant directory</p><h2>Companies</h2></div><span>{companies.length} total</span></div>
          {companies.length ? (
            <div className="company-table-wrap">
              <table className="company-table">
                <thead><tr><th>Company</th><th>Login email</th><th>Projects</th><th>Posters</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>{companies.map((company) => {
                  const companyProjects = projects.filter((project) => project.companyId === company.id).length;
                  return (
                    <tr className={selectedCompanyId === company.id ? "selected-row" : ""} key={company.id}>
                      <td><strong>{company.name}</strong><small>/{company.slug}</small></td>
                      <td>{company.email}</td>
                      <td>{companyProjects}</td>
                      <td>{company.posterCount}</td>
                      <td>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(company.createdAt))}</td>
                      <td><div className="table-actions"><button type="button" onClick={() => selectCompany(company.id)}>Select</button><button type="button" onClick={() => { selectCompany(company.id); setEditingCompany(true); setShowEditPassword(false); }}>Edit</button><button className="delete-link" type="button" onClick={() => deleteSelectedCompany(company)}>Delete</button></div></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : (
            <div className="empty-admin"><Building2 size={30} /><h3>No companies yet</h3><p>Create the first company above.</p></div>
          )}
        </section>
      </main>
    </div>
  );
}
