import { Download, ExternalLink, FileSpreadsheet, FileText, Globe, Video } from "lucide-react";
import { assetActionHref, contentTypeOptions, type ContentType } from "@/domain/asset-types";

export function AssetPreview({ src, title, contentType = "image", originalName, compact = false, watermark = false }: {
  src: string;
  title: string;
  contentType?: ContentType;
  originalName?: string;
  compact?: boolean;
  watermark?: boolean;
}) {
  if (contentType === "image") {
    return <span className="asset-preview asset-preview--image"><img src={src} alt={title} />{watermark ? <span className="preview-watermark" aria-hidden="true">ClientLoop</span> : null}</span>;
  }
  if (contentType === "video" && !compact) {
    return (
      <span className="asset-preview asset-preview--video">
        <video key={src} src={src} controls playsInline preload="metadata" aria-label={title} />
        <a className="asset-preview-action" href={assetActionHref(src, contentType)}><Download size={16} />Download video</a>
      </span>
    );
  }
  if (contentType === "pdf" && !compact) {
    return (
      <span className="asset-preview asset-preview--pdf">
        <iframe key={src} src={src} title={`${title} PDF preview`} loading="lazy" />
        <a className="asset-preview-action" href={src} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />Open PDF</a>
      </span>
    );
  }
  const Icon = contentType === "video" ? Video : contentType === "website" ? Globe : contentType === "excel" ? FileSpreadsheet : FileText;
  return (
    <span className={`asset-preview asset-preview-card${compact ? " asset-preview--compact" : ""}`}>
      <Icon className="asset-type-icon" size={compact ? 26 : 40} aria-hidden="true" />
      <span className="asset-type-label">{contentTypeOptions[contentType].label}</span>
      {!compact ? <>
        <span className="asset-file-name">{originalName || title}</span>
        {contentType === "word" || contentType === "excel" ? <span className="asset-preview-hint">Download to view this document.</span> : null}
        <a className="asset-preview-action" href={assetActionHref(src, contentType)} target={contentType === "website" ? "_blank" : undefined} rel={contentType === "website" ? "noopener noreferrer" : undefined}>
          {contentType === "website" ? <ExternalLink size={16} /> : <Download size={16} />}
          {contentType === "website" ? "Open website" : `Download ${contentTypeOptions[contentType].label}`}
        </a>
      </> : null}
    </span>
  );
}
