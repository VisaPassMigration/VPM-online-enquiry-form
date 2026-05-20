import { db } from '@/server/db';

export type AssignStaffTaskInput = {
  taskId: string;
  assigneeStaffUserId: string;
  assignedByStaffUserId: string;
};

export async function assignStaffTask(input: AssignStaffTaskInput) {
  return (db as unknown as {
    staffTask: {
      update: (args: object) => Promise<Record<string, unknown>>;
    };
  }).staffTask.update({
    where: { id: input.taskId },
    data: {
      assigneeStaffUserId: input.assigneeStaffUserId,
      assignedByStaffUserId: input.assignedByStaffUserId,
    },
    include: {
      assigneeStaffUser: { select: { id: true, displayName: true, email: true } },
      assignedByStaffUser: { select: { id: true, displayName: true, email: true } },
    },
  });
}
