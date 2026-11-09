// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { SessionResult } from "@/components/session-result";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows a confirmed completed record link and clears the draft", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "completed",
          publication: "published",
          recordAvailable: true,
          caseId: "b0000000-0000-4000-8000-000000000002",
          caseStatus: "completed",
        }),
      }),
  );
  const saved = vi.fn();
  render(<SessionResult onSaved={saved} />);
  expect(screen.getByRole("status").textContent).toContain("Preparing report");
  const link = await screen.findByRole("link", {
    name: "View Generated Record",
  });
  expect(link.getAttribute("href")).toBe(
    "/records/b0000000-0000-4000-8000-000000000002",
  );
  expect(saved).toHaveBeenCalledOnce();
});
it.each(["withheld", "failed"])(
  "shows %s without a successful link",
  async (publication) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            status: "incomplete",
            publication,
            recordAvailable: false,
          }),
        }),
    );
    render(<SessionResult onSaved={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(
        publication === "withheld" ? /withheld/ : /could not be saved/,
      ),
    );
    expect(screen.queryByRole("link")).toBeNull();
  },
);
