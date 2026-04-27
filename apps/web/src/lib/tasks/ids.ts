const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getPublicTaskId(task: { id: string; public_task_id?: string | null }) {
  return task.public_task_id ?? task.id.replaceAll('-', '').slice(-12);
}

export function getTaskIdColumn(id: string) {
  return UUID_PATTERN.test(id) ? 'id' : 'public_task_id';
}

export function getTaskHref(task: { id: string; public_task_id?: string | null }) {
  return `/tasks/${getPublicTaskId(task)}`;
}
