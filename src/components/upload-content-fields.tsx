"use client";

import { useState } from "react";
import { contentTypes, contentTypeOptions, isContentType, normalizeWebsiteUrl, type ContentType } from "@/domain/asset-types";

export function UploadContentFields({ initialType = "image", disabled }: { initialType?: ContentType; disabled: boolean }) {
  const [contentType, setContentType] = useState(initialType);
  const option = contentTypeOptions[contentType];
  return (
    <fieldset className="upload-content-fields" disabled={disabled}>
      <label>Content type
        <select name="contentType" value={contentType} onChange={(event) => { if (isContentType(event.target.value)) setContentType(event.target.value); }}>
          {contentTypes.map((type) => <option key={type} value={type}>{contentTypeOptions[type].label}</option>)}
        </select>
      </label>
      {contentType === "website" ? (
        <label>Website link
          <input name="websiteUrl" type="url" maxLength={2048} placeholder="https://example.com" required onChange={(event) => {
            event.currentTarget.setCustomValidity(normalizeWebsiteUrl(event.currentTarget.value) ? "" : "Enter a valid http:// or https:// website link without login credentials.");
          }} />
          <small>{option.help}</small>
        </label>
      ) : (
        <label className="admin-file-field"><span>{option.label} file</span>
          <input key={contentType} name="file" type="file" accept={option.accept} required onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            const valid = !file || (file.size > 0 && file.size <= option.maximumBytes);
            event.currentTarget.setCustomValidity(valid ? "" : `Choose a non-empty file. ${option.help}.`);
            if (!valid) event.currentTarget.reportValidity();
          }} />
          <small>{option.help}</small>
        </label>
      )}
    </fieldset>
  );
}
