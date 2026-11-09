// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Room } from "livekit-client";
import { RoomContext } from "@livekit/components-react";
import { MicrophoneCheck } from "@/components/voice-demo";

const state = vi.hoisted(() => ({ volume: 0.35, enabled: true }));
vi.mock("@livekit/components-react", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@livekit/components-react")>();
  return {
    ...actual,
    useLocalParticipant: () => ({
      localParticipant: { getTrackPublication: () => undefined },
      isMicrophoneEnabled: state.enabled,
    }),
    useTrackVolume: () => state.volume,
  };
});
let room: Room;
let enumerate: ReturnType<typeof vi.fn>;
const hardware = [
  {
    deviceId: "default",
    kind: "audioinput",
    groupId: "g",
    label: "System microphone",
  },
  {
    deviceId: "usb-mic",
    kind: "audioinput",
    groupId: "g2",
    label: "USB microphone",
  },
];
beforeEach(() => {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  state.volume = 0.35;
  state.enabled = true;
  room = new Room();
  enumerate = vi.fn(async () => {
    // Stop a broken render loop without letting it consume unbounded CPU in CI.
    if (enumerate.mock.calls.length > 10) {
      cleanup();
      throw new Error("Device enumeration restarted repeatedly");
    }
    return hardware;
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      enumerateDevices: enumerate,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const mount = () =>
  render(
    <RoomContext.Provider value={room}>
      <MicrophoneCheck />
    </RoomContext.Provider>,
  );
describe("connected microphone controls with the real device-selection hook", () => {
  it("settles the device list and keeps it stable as the level updates", async () => {
    const view = mount();
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "USB microphone" }),
      ).toBeTruthy(),
    );
    const before = enumerate.mock.calls.length;
    for (const volume of [0.1, 0.4, 0.7]) {
      state.volume = volume;
      view.rerender(
        <RoomContext.Provider value={room}>
          <MicrophoneCheck />
        </RoomContext.Provider>,
      );
    }
    expect(
      screen.getByLabelText("Microphone input level").getAttribute("value"),
    ).toBe("0.7");
    expect(enumerate.mock.calls.length).toBe(before);
  });
  it("keeps a labeled default option while the device list is unavailable", async () => {
    enumerate.mockResolvedValue([]);
    mount();
    await waitFor(() => expect(enumerate).toHaveBeenCalled());
    const select = screen.getByLabelText("Microphone") as HTMLSelectElement;
    expect(select.selectedOptions[0]?.textContent).toBe(
      "System default microphone",
    );
  });
  it("switches inputs through the room and reports a failed switch", async () => {
    vi.spyOn(room, "switchActiveDevice").mockRejectedValue(
      new Error("synthetic device unavailable"),
    );
    mount();
    await screen.findByRole("option", { name: "USB microphone" });
    fireEvent.change(screen.getByLabelText("Microphone"), {
      target: { value: "usb-mic" },
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Unable to switch microphones",
      ),
    );
  });
  it("shows zero input while muted", async () => {
    state.enabled = false;
    mount();
    await screen.findByRole("option", { name: "USB microphone" });
    expect(
      screen.getByLabelText("Microphone is muted").getAttribute("value"),
    ).toBe("0");
  });
});
