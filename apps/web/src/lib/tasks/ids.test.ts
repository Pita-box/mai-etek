import { describe, expect, it } from "vitest";
import { getPublicTaskId, getTaskHref, getTaskIdColumn } from "./ids";

describe("task id helpers", () => {
  it("prefers public task ids when present", () => {
    const task = {
      id: "2f3b6f40-8e3f-4e2f-9a4c-3d9f0c6d1234",
      public_task_id: "tsk_abc123",
    };

    expect(getPublicTaskId(task)).toBe("tsk_abc123");
    expect(getTaskHref(task)).toBe("/tasks/tsk_abc123");
  });

  it("falls back to a compact id suffix for legacy tasks", () => {
    const task = {
      id: "2f3b6f40-8e3f-4e2f-9a4c-3d9f0c6d1234",
      public_task_id: null,
    };

    expect(getPublicTaskId(task)).toBe("3d9f0c6d1234");
    expect(getTaskHref(task)).toBe("/tasks/3d9f0c6d1234");
  });

  it("selects the database lookup column by id format", () => {
    expect(getTaskIdColumn("2f3b6f40-8e3f-4e2f-9a4c-3d9f0c6d1234")).toBe(
      "id",
    );
    expect(getTaskIdColumn("tsk_abc123")).toBe("public_task_id");
  });
});
