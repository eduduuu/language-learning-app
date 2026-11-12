import React from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

interface LegalModalProps {
  type: 'terms' | 'privacy';
  onClose: () => void;
}

export function LegalModal({ type, onClose }: LegalModalProps) {
  const isTerms = type === 'terms';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl border border-zinc-800/80 bg-zinc-900/95 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/70">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-9 h-9 rounded-lg bg-amber-400/10 ring-1 ring-amber-400/30 text-amber-400">
              {isTerms ? <FileText size={18} /> : <ShieldCheck size={18} />}
            </div>
            <div>
              <h2 className="font-display text-lg text-zinc-100">
                {isTerms ? 'Terms of Service' : 'Privacy Policy'}
              </h2>
              <p className="text-xs text-zinc-400">
                Last updated: November 2026
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-zinc-300 leading-relaxed font-sans">
          {isTerms ? (
            <>
              <h3 className="text-sm font-semibold text-zinc-100">1. Local-First Architecture</h3>
              <p>
                Bunmyaku (文脈) processes and stores your imported EPUB text and book content locally on your device within your browser's IndexedDB storage. We do not store or distribute copyrighted book contents on our servers.
              </p>

              <h3 className="text-sm font-semibold text-zinc-100">2. User Accounts & Fair Use</h3>
              <p>
                By creating an account, you agree to provide accurate information. Free tier accounts may register up to five books simultaneously and maintain up to 250 active vocabulary review cards for dictionary synchronization and progress tracking. Abuse or automated scraping of translation and SRS services may result in suspension.
              </p>


              <h3 className="text-sm font-semibold text-zinc-100">3. AI-Assisted Enrichment</h3>
              <p>
                Grammar explanations, sentence clozes, and translations are generated using artificial intelligence (Gemini and Groq). While designed for high precision, they are educational aids and may occasionally contain minor inaccuracies.
              </p>

              <h3 className="text-sm font-semibold text-zinc-100">4. Limitation of Liability</h3>
              <p>
                Bunmyaku (文脈) is provided on an "as is" and "as available" basis without warranties of any kind. You retain full responsibility for the material you import and read.
              </p>

            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-zinc-100">1. Information We Collect</h3>
              <p>
                We collect your email address and authentication credentials via Supabase when you create an account. For synchronized features, we store your flashcard review history (FSRS algorithm state), vocabulary lookups, and reading bookmarks.
              </p>

              <h3 className="text-sm font-semibold text-zinc-100">2. What We Do NOT Collect</h3>
              <p>
                We do not upload or store your full EPUB manuscripts or raw book files on our servers. Your reading files remain encrypted or contained inside your browser's private local storage.
              </p>

              <h3 className="text-sm font-semibold text-zinc-100">3. Third-Party Services</h3>
              <p>
                We use Supabase for secure cloud authentication and database storage, Google Gemini / Groq for sentence enrichments, and public APIs (Bluesky ATProto) to provide real-world usage examples.
              </p>

              <h3 className="text-sm font-semibold text-zinc-100">4. Data Deletion & Privacy Rights (LGPD & GDPR)</h3>
              <p>
                In compliance with the Brazilian General Data Protection Law (LGPD — Lei Federal nº 13.709/2018) and international regulations (GDPR), you retain full rights over your data. You may request confirmation of processing, access to your data, correction of incomplete or outdated data, or complete deletion of your personal data and flashcards at any time. Local books can be permanently removed with one click directly from your library.
              </p>

            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/70 bg-zinc-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
