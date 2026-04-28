'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitTask } from '@/actions/tasks';
import { Upload, FileText, Image as ImageIcon, Video, Loader2 } from 'lucide-react';
// Assuming you have some basic UI components like Button, Input in a ui folder.
// Since I don't see them, I'll use standard HTML/Tailwind for simplicity here.

export const EvidenceUpload = ({ taskId }: { taskId: string }) => {
  const router = useRouter();
  const [type, setType] = useState<'text' | 'image' | 'video'>('text');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Obsah důkazu je povinný.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const evidenceData: { text?: string; imageUrl?: string; videoUrl?: string } = {};
      if (type === 'text') {
        evidenceData.text = content;
      } else if (type === 'image') {
        evidenceData.imageUrl = content;
      } else if (type === 'video') {
        evidenceData.videoUrl = content;
      }
      await submitTask(taskId, evidenceData);
      router.refresh(); // Refresh page to show new status
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Něco se pokazilo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-glass-panel border border-glass-border rounded-xl p-6 mt-6">
      <h3 className="text-xl font-medium text-white mb-4">Odeslat důkaz</h3>
      
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setType('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${type === 'text' ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'}`}
        >
          <FileText className="w-4 h-4" /> Text
        </button>
        <button
          type="button"
          onClick={() => setType('image')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${type === 'image' ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'}`}
        >
          <ImageIcon className="w-4 h-4" /> Odkaz na obrázek
        </button>
        <button
          type="button"
          onClick={() => setType('video')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${type === 'video' ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'}`}
        >
          <Video className="w-4 h-4" /> Odkaz na video
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'text' ? (
          <div>
            <textarea
              className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 min-h-[100px]"
              placeholder="Popiš, jak jsi úkol splnil..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        ) : (
          <div>
            <input
              type="url"
              className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
              placeholder={`Zadej URL odkaz na ${type === 'image' ? 'obrázek' : 'video'}...`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          Odeslat ke kontrole
        </button>
      </form>
    </div>
  );
};
