import React, { useEffect, useState } from 'react';
import { PhpFileEntry } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const PhpBundleModal: React.FC<Props> = ({ open, onClose }) => {
  const [files, setFiles] = useState<PhpFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || files.length > 0) return;
    setLoading(true);
    fetch('/api/php-files')
      .then((r) => r.json())
      .then((d) => {
        const list: PhpFileEntry[] = d.files || [];
        setFiles(list);
        const firstText = list.find((f) => !f.isBinary);
        if (firstText) setSelectedPath(firstText.path);
      })
      .finally(() => setLoading(false));
  }, [open, files.length]);

  if (!open) return null;

  const activeFile = files.find((f) => f.path === selectedPath);

  const handleCopy = () => {
    if (!activeFile?.content) return;
    navigator.clipboard?.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-5xl h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <i className="fa-brands fa-php text-lg"></i>
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">Quick Kart PHP &amp; MySQL Package</h2>
              <p className="text-xs text-slate-500 truncate">Ready-to-upload Apache/XAMPP/cPanel folder with install.php &amp; assets</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                const res = await fetch('/api/download-php-zip');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'quick-kart-php-mysql.zip';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition inline-flex items-center gap-1.5"
            >
              <i className="fa-solid fa-download"></i>
              <span>Download ZIP</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid md:grid-cols-[260px_1fr]">
          <div className="border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto bg-slate-50 p-2.5 space-y-1 max-h-44 md:max-h-none">
            {loading ? (
              <p className="text-xs text-slate-500 p-3">Loading project files...</p>
            ) : (
              files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setSelectedPath(f.path)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono truncate flex items-center gap-2 transition ${
                    selectedPath === f.path
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <i className={`fa-solid ${f.isBinary ? 'fa-image text-orange-500' : 'fa-file-code text-slate-400'} text-[11px]`}></i>
                  <span className="truncate">{f.path}</span>
                </button>
              ))
            )}
          </div>

          <div className="flex flex-col min-h-0 bg-slate-950 text-slate-100">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-300 truncate">quick-kart/{selectedPath}</span>
              {!activeFile?.isBinary && activeFile?.content && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  <i className={`fa-solid ${copied ? 'fa-check text-emerald-400' : 'fa-copy'} mr-1.5`}></i>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {activeFile?.isBinary ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                  <i className="fa-solid fa-image text-3xl text-slate-600"></i>
                  <span>Binary image asset included in ZIP archive: quick-kart/{activeFile.path}</span>
                </div>
              ) : (
                <pre className="text-xs font-mono leading-relaxed text-slate-200 whitespace-pre select-text">
                  {activeFile?.content || ''}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
