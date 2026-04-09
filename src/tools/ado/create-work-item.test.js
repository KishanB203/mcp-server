import { jest } from "@jest/globals";

const postMock = jest.fn();

jest.unstable_mockModule("../../infrastructure/ado/ado-client.js", () => ({
  adoClient: {
    post: postMock,
  },
}));

const { createWorkItem } = await import("./create-work-item.js");

describe("createWorkItem", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("throws when title is missing", async () => {
    await expect(createWorkItem({})).rejects.toThrow("title is required");
    expect(postMock).not.toHaveBeenCalled();
  });

  it("creates a Task with sprint/state/type/assignedTo", async () => {
    postMock.mockResolvedValue({
      data: {
        id: 123,
        fields: {
          "System.WorkItemType": "Task",
          "System.Title": "My title",
          "System.State": "To Do",
          "System.IterationPath": "Project\\Sprint 1",
          "System.AssignedTo": { displayName: "Kishan" },
        },
        _links: { html: { href: "https://dev.azure.com/org/project/_workitems/edit/123" } },
      },
    });

    const result = await createWorkItem({
      title: "My title",
      type: "Task",
      state: "To Do",
      assignedTo: "Kishan",
      sprint: "Project\\Sprint 1",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][0]).toBe("/wit/workitems/$Task");
    expect(postMock.mock.calls[0][2]).toEqual({
      headers: { "Content-Type": "application/json-patch+json" },
    });

    expect(result).toEqual({
      id: 123,
      url: "https://dev.azure.com/org/project/_workitems/edit/123",
      type: "Task",
      title: "My title",
      state: "To Do",
      assignedTo: "Kishan",
      iterationPath: "Project\\Sprint 1",
      sprint: "Project\\Sprint 1",
    });
  });
});

