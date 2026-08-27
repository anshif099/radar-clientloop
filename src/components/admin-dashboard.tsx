"use client";

import { Building2, ImagePlus, LogOut, Plus, Upload } from "lucide-react";
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

async function responseMessage(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  return body.message ?? `Request failed (${response.status}).`;
}

export function AdminDashboard({ initialCompanies, adminName }: { initialCompanies: Company[]; adminName: string }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const createCompany = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCompanyBusy(true);
    setMessage(null);
    const form = new FormData(formElement);
    const response = await fetch("/api/v1/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    if (!response.ok) {
      setMessage({ kind: "error", text: await responseMessage(response) });
      setCompanyBusy(false);
      return;
    }
    const { company } = await response.json() as { company: Omit<Company, "posterCount" | "createdAt"> };
    setCompanies((current) => [{ ...company, posterCount: 0, createdAt: new Date().toISOString() }, ...current]);
    formElement.reset();
    setMessage({ kind: "success", text: `${company.name} and its private login were created.` });
    setCompanyBusy(false);
  };

  const uploadPoster = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPosterBusy(true);
    setMessage(null);
    const form = new FormData(formElement);
    const companyId = String(form.get("companyId") ?? "");
    const response = await fetch("/api/v1/admin/posters", { method: "POST", body: form });
    if (!response.ok) {
      setMessage({ kind: "error", text: await responseMessage(response) });
      setPosterBusy(false);
      return;
    }
    setCompanies((current) => current.map((company) => company.id === companyId ? { ...company, posterCount: company.posterCount + 1 } : company));
    formElement.reset();
    setMessage({ kind: "success", text: "Poster published to the selected company only." });
    setPosterBusy(false);
  };

  const signOut = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="auth-brand"><Image src="/brand/app-icon.svg" width={42} height={42} alt="" priority /><div><strong>ClientLoop</strong><span>Super Admin</span></div></div>
        <div className="admin-account"><span>{adminName}</span><button className="secondary-button" type="button" onClick={signOut}><LogOut size={17} />Sign out</button></div>
      </header>
      <main className="admin-main">
        <section className="admin-intro"><p className="eyebrow">Platform control</p><h1>Companies and posters</h1><p>Create a private login for each company, then publish posters directly to its isolated workspace.</p></section>
        {message ? <p className={`form-alert ${message.kind === "error" ? "error-alert" : "success-alert"}`} role="status">{message.text}</p> : null}
        <div className="admin-grid">
          <section className="admin-card">
            <div className="card-heading"><span className="admin-icon"><Plus size={21} /></span><div><h2>Add company</h2><p>Creates one tenant and one company login.</p></div></div>
            <form className="stack-form" onSubmit={createCompany}>
              <label>Company name<input name="name" minLength={2} maxLength={180} required /></label>
              <label>Company login email<input name="email" type="email" autoComplete="off" required /></label>
              <label>Initial password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /><small>At least 12 characters. Share it securely with the company.</small></label>
              <button className="primary-button" type="submit" disabled={companyBusy}><Building2 size={18} />{companyBusy ? "Creating…" : "Create company"}</button>
            </form>
          </section>
          <section className="admin-card">
            <div className="card-heading"><span className="admin-icon"><ImagePlus size={21} /></span><div><h2>Add poster</h2><p>The file is visible only to the selected company.</p></div></div>
            <form className="stack-form" onSubmit={uploadPoster}>
              <label>Company<select name="companyId" required defaultValue=""><option value="" disabled>Select a company</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>
              <label>Poster title<input name="title" maxLength={220} required /></label>
              <label>Category<input name="category" maxLength={100} defaultValue="Posters" required /></label>
              <label>Note<textarea name="note" maxLength={3000} rows={3} /></label>
              <label className="file-input">Poster image<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /><small>JPG, PNG, WebP, or GIF · maximum 20 MB</small></label>
              <button className="primary-button" type="submit" disabled={posterBusy || !companies.length}><Upload size={18} />{posterBusy ? "Uploading…" : "Publish poster"}</button>
            </form>
          </section>
        </div>
        <section className="company-section">
          <div className="section-title"><div><p className="eyebrow">Tenant directory</p><h2>Companies</h2></div><span>{companies.length} total</span></div>
          {companies.length ? <div className="company-table-wrap"><table className="company-table"><thead><tr><th>Company</th><th>Login email</th><th>Posters</th><th>Created</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id}><td><strong>{company.name}</strong><small>/{company.slug}</small></td><td>{company.email}</td><td>{company.posterCount}</td><td>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(company.createdAt))}</td></tr>)}</tbody></table></div> : <div className="empty-admin"><Building2 size={30} /><h3>No companies yet</h3><p>Create the first company above. No sample data is inserted.</p></div>}
        </section>
      </main>
    </div>
  );
}
