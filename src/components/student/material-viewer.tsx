'use client';

import * as React from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  Presentation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { MATERIAL_TYPES } from '@/lib/constants';
import { formatBytes } from '@/lib/utils';
import { saveMediaPositionAction } from '@/app/student/actions';

/**
 * Material viewers.
 *
 * Every file is fetched from the authenticated `/api/files/:id` route, never
 * from a public path, so the browser's own player and PDF viewer can be used
 * without the file ever becoming publicly reachable.
 *
 * Video and audio remember their position: the player restores where the
 * student stopped and reports progress back every few seconds, which is what
 * makes "continue where you left off" real rather than decorative.
 */

export interface MaterialViewerProps {
  materialId: string;
  type: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  title: string;
  downloadable: boolean;
  initialPositionSeconds?: number;
}

export function MaterialViewer(props: MaterialViewerProps) {
  switch (props.type) {
    case MATERIAL_TYPES.VIDEO:
      return <VideoViewer {...props} />;
    case MATERIAL_TYPES.AUDIO:
      return <AudioViewer {...props} />;
    case MATERIAL_TYPES.PDF:
      return <PdfViewer {...props} />;
    case MATERIAL_TYPES.PPTX:
      return <OfficeViewer {...props} kind="presentation" />;
    case MATERIAL_TYPES.DOCX:
      return <OfficeViewer {...props} kind="document" />;
    default:
      return <DownloadOnly {...props} />;
  }
}

function fileUrl(fileId: string, download = false): string {
  return `/api/files/${fileId}${download ? '?download=1' : ''}`;
}

// -----------------------------------------------------------------------------
// Media
// -----------------------------------------------------------------------------

/** Reports position at most every 15 seconds, and once more on unmount. */
function useMediaProgress(
  materialId: string,
  ref: React.RefObject<HTMLMediaElement | null>,
) {
  const lastSent = React.useRef(0);

  const report = React.useCallback(
    (force = false) => {
      const element = ref.current;
      if (!element || !Number.isFinite(element.duration) || element.duration <= 0) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastSent.current < 15_000) return;
      lastSent.current = now;

      const percent = (element.currentTime / element.duration) * 100;
      void saveMediaPositionAction(materialId, element.currentTime, percent).catch(
        () => undefined,
      );
    },
    [materialId, ref],
  );

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onTimeUpdate = () => report(false);
    const onPause = () => report(true);
    // A closing tab still gets one last save in.
    const onHide = () => report(true);

    element.addEventListener('timeupdate', onTimeUpdate);
    element.addEventListener('pause', onPause);
    document.addEventListener('visibilitychange', onHide);

    return () => {
      element.removeEventListener('timeupdate', onTimeUpdate);
      element.removeEventListener('pause', onPause);
      document.removeEventListener('visibilitychange', onHide);
      report(true);
    };
  }, [report, ref]);
}

function VideoViewer({
  materialId,
  fileId,
  title,
  downloadable,
  initialPositionSeconds = 0,
}: MaterialViewerProps) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [resumed, setResumed] = React.useState(false);
  useMediaProgress(materialId, ref);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-black shadow-[var(--shadow-soft)]">
        <video
          ref={ref}
          controls
          controlsList={downloadable ? undefined : 'nodownload'}
          preload="metadata"
          playsInline
          className="aspect-video w-full"
          onLoadedMetadata={(event) => {
            if (resumed || initialPositionSeconds <= 0) return;
            const element = event.currentTarget;
            // Do not resume within the last few seconds — the student has
            // effectively finished, and dropping them at the end is annoying.
            if (initialPositionSeconds < element.duration - 5) {
              element.currentTime = initialPositionSeconds;
            }
            setResumed(true);
          }}
        >
          <source src={fileUrl(fileId)} />
          Your browser cannot play this video.
        </video>
      </div>

      {initialPositionSeconds > 5 && resumed ? (
        <p className="text-xs text-[var(--text-muted)]">
          Resumed from where you stopped last time.
        </p>
      ) : null}

      <MediaActions fileId={fileId} title={title} downloadable={downloadable} />
    </div>
  );
}

function AudioViewer({
  materialId,
  fileId,
  title,
  downloadable,
  initialPositionSeconds = 0,
}: MaterialViewerProps) {
  const ref = React.useRef<HTMLAudioElement>(null);
  const [resumed, setResumed] = React.useState(false);
  useMediaProgress(materialId, ref);

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-gradient-to-br from-brand-50 to-spark-300/20 p-6 dark:from-brand-950 dark:to-spark-600/10">
        <p className="mb-4 text-sm font-bold text-[var(--text-strong)]">{title}</p>
        <audio
          ref={ref}
          controls
          controlsList={downloadable ? undefined : 'nodownload'}
          preload="metadata"
          className="w-full"
          onLoadedMetadata={(event) => {
            if (resumed || initialPositionSeconds <= 0) return;
            const element = event.currentTarget;
            if (initialPositionSeconds < element.duration - 5) {
              element.currentTime = initialPositionSeconds;
            }
            setResumed(true);
          }}
        >
          <source src={fileUrl(fileId)} />
          Your browser cannot play this audio.
        </audio>
      </div>

      <MediaActions fileId={fileId} title={title} downloadable={downloadable} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Documents
// -----------------------------------------------------------------------------

function PdfViewer({ fileId, title, fileSize, downloadable }: MaterialViewerProps) {
  const [failed, setFailed] = React.useState(false);

  return (
    <div className="space-y-3">
      {failed ? (
        <Alert tone="info" title="This browser cannot show the PDF inline">
          Open it in a new tab instead — it will still be delivered securely.
        </Alert>
      ) : (
        <object
          data={fileUrl(fileId)}
          type="application/pdf"
          className="h-[70vh] min-h-96 w-full rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-sunken)]"
          onError={() => setFailed(true)}
          aria-label={title}
        >
          {/* Shown when the browser has no built-in PDF viewer (common on
              older Android phones), so the lesson is still reachable. */}
          <div className="p-8 text-center">
            <FileText
              className="mx-auto mb-3 size-8 text-[var(--text-muted)]"
              aria-hidden
            />
            <p className="text-sm text-[var(--text-muted)]">
              Your browser cannot display this PDF here.
            </p>
          </div>
        </object>
      )}

      <MediaActions
        fileId={fileId}
        title={title}
        downloadable={downloadable}
        fileSize={fileSize}
        openLabel="Open in a new tab"
      />
    </div>
  );
}

/**
 * Office documents.
 *
 * There is no honest way to render a .pptx or .docx inside the page without
 * sending the file to a third-party viewer service — which would mean shipping
 * school material off-platform. So the student gets a clear card, an "open"
 * action and a download, and the interface says plainly what will happen.
 */
function OfficeViewer({
  fileId,
  title,
  fileName,
  fileSize,
  downloadable,
  kind,
}: MaterialViewerProps & { kind: 'presentation' | 'document' }) {
  const Icon = kind === 'presentation' ? Presentation : FileText;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-8 text-center">
      <span
        className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        aria-hidden
      >
        <Icon className="size-7" />
      </span>
      <h3 className="text-base font-bold text-[var(--text-strong)]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">
        {kind === 'presentation'
          ? 'This is a PowerPoint presentation. Open it with your device’s presentation app.'
          : 'This is a Word document. Open it with your device’s document app.'}
      </p>
      <p className="mt-2 font-mono text-xs text-[var(--text-muted)]">
        {fileName} · {formatBytes(fileSize)}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <a href={fileUrl(fileId)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden />
            Open
          </a>
        </Button>
        {downloadable ? (
          <Button asChild variant="secondary">
            <a href={fileUrl(fileId, true)}>
              <Download className="size-4" aria-hidden />
              Download
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DownloadOnly({ fileId, title, fileName, fileSize }: MaterialViewerProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] p-8 text-center">
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
        {fileName} · {formatBytes(fileSize)}
      </p>
      <Button asChild className="mt-5">
        <a href={fileUrl(fileId, true)}>
          <Download className="size-4" aria-hidden />
          Download
        </a>
      </Button>
    </div>
  );
}

function MediaActions({
  fileId,
  downloadable,
  fileSize,
  openLabel = 'Open full screen',
}: {
  fileId: string;
  title: string;
  downloadable: boolean;
  fileSize?: number;
  openLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="secondary" size="sm">
        <a href={fileUrl(fileId)} target="_blank" rel="noreferrer">
          <Maximize2 className="size-4" aria-hidden />
          {openLabel}
        </a>
      </Button>
      {downloadable ? (
        <Button asChild variant="ghost" size="sm">
          <a href={fileUrl(fileId, true)}>
            <Download className="size-4" aria-hidden />
            Download{fileSize ? ` (${formatBytes(fileSize)})` : ''}
          </a>
        </Button>
      ) : (
        <span className="text-xs text-[var(--text-muted)]">
          Downloading is turned off for this material.
        </span>
      )}
    </div>
  );
}
