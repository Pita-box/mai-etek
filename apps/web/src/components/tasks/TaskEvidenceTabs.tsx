'use client';

import { FileText, Image as ImageIcon, Video } from 'lucide-react';
import { Task } from '@/types/task';
import { TaskCommentsThread } from './TaskCommentsThread';
import { TaskMediaGallery } from './TaskMediaGallery';
import { TaskTextEvidence } from './TaskTextEvidence';

export type EvidenceTab = 'text' | 'photos' | 'videos';

type TaskEvidenceTabsProps = {
  task: Task;
  role: 'dom' | 'sub';
  activeTab: EvidenceTab;
  onActiveTabChange: (tab: EvidenceTab) => void;
  onTaskMutated: () => Promise<void>;
};

const tabs: Array<{ key: EvidenceTab; label: string; icon: typeof FileText }> = [
  { key: 'text', label: 'Text', icon: FileText },
  { key: 'photos', label: 'Fotky', icon: ImageIcon },
  { key: 'videos', label: 'Videa', icon: Video },
];

export function TaskEvidenceTabs({ task, role, activeTab, onActiveTabChange, onTaskMutated }: TaskEvidenceTabsProps) {
  const textCount = (task.task_attempts?.filter((attempt) => attempt.text_content).length || 0) + (task.task_evidence?.filter((item) => item.type === 'text').length || 0);
  const photoCount = (task.task_media?.filter((item) => item.media_type === 'image').length || 0) + (task.task_evidence?.filter((item) => item.type === 'image').length || 0);
  const videoCount = (task.task_media?.filter((item) => item.media_type === 'video').length || 0) + (task.task_evidence?.filter((item) => item.type === 'video').length || 0);
  const counts: Record<EvidenceTab, number> = { text: textCount, photos: photoCount, videos: videoCount };
  const textEvidenceSnapshotKey = [
    task.id,
    task.updated_at,
    task.status,
    task.task_attempts?.[0]?.text_content || '',
    task.task_attempts?.[0]?.submitted_at || '',
    task.task_evidence?.find((item) => item.type === 'text')?.content || '',
  ].join(':');

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
      <div role="tablist" aria-label="Důkazy k úkolu" className="grid grid-cols-3 gap-2 rounded-2xl bg-black/30 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              id={`task-evidence-tab-${tab.key}`}
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onActiveTabChange(tab.key)}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-primary ${active ? 'bg-primary text-white' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-black/15' : 'bg-white/10 text-zinc-500'}`}>{counts[tab.key]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-5 p-2">
        {activeTab === 'text' ? <TaskTextEvidence key={textEvidenceSnapshotKey} task={task} role={role} onTaskMutated={onTaskMutated} /> : null}
        {activeTab === 'photos' ? <TaskMediaGallery task={task} mediaType="image" role={role} onTaskMutated={onTaskMutated} /> : null}
        {activeTab === 'videos' ? <TaskMediaGallery task={task} mediaType="video" role={role} onTaskMutated={onTaskMutated} /> : null}
        <TaskCommentsThread taskId={task.id} tabType={activeTab} />
      </div>
    </section>
  );
}
