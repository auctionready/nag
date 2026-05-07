import { Text } from "react-native";
import { render, act } from "@testing-library/react-native";
import { AppState, type NativeEventSubscription } from "react-native";
import {
  TodayProvider,
  epochMinuteToDate,
  useCurrentEpochMinute,
  useStartOfToday,
} from "../today";

type AppStateChangeListener = Parameters<typeof AppState.addEventListener>[1];

describe("TodayProvider / useStartOfToday", () => {
  // Object-wrapped so the mockImplementation closure mutates a property,
  // not a top-level `let` (react-compiler flags the latter as a side effect).
  const captured: { listener: AppStateChangeListener | null } = {
    listener: null,
  };

  beforeEach(() => {
    captured.listener = null;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((event, listener) => {
        if (event === "change") {
          captured.listener = listener;
        }
        return { remove: jest.fn() } as unknown as NativeEventSubscription;
      });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const Probe = () => {
    const todayStart = useStartOfToday();
    return <Text testID="today">{todayStart.toISOString()}</Text>;
  };

  it("returns startOfDay of current local time on mount", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 7, 14, 30));

    const view = render(
      <TodayProvider>
        <Probe />
      </TodayProvider>,
    );

    expect(view.getByTestId("today").props.children).toBe(
      new Date(2026, 4, 7).toISOString(),
    );
  });

  it("flips to the new day when the midnight timer fires", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 7, 23, 59, 30));

    const view = render(
      <TodayProvider>
        <Probe />
      </TodayProvider>,
    );

    expect(view.getByTestId("today").props.children).toBe(
      new Date(2026, 4, 7).toISOString(),
    );

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(view.getByTestId("today").props.children).toBe(
      new Date(2026, 4, 8).toISOString(),
    );
  });

  it("flips when AppState becomes active after the system clock crossed midnight", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 7, 22, 0));

    const view = render(
      <TodayProvider>
        <Probe />
      </TodayProvider>,
    );

    expect(view.getByTestId("today").props.children).toBe(
      new Date(2026, 4, 7).toISOString(),
    );

    // Simulate the app being backgrounded across midnight: jump the clock
    // forward without firing the JS timer (mirrors the OS suspending JS).
    jest.setSystemTime(new Date(2026, 4, 8, 8, 15));
    act(() => {
      captured.listener?.("active");
    });

    expect(view.getByTestId("today").props.children).toBe(
      new Date(2026, 4, 8).toISOString(),
    );
  });

  it("does not re-render on AppState active when the day is unchanged", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 7, 9, 0));

    // jest.fn() instead of an outside-component `let` so the in-render
    // mutation is a function call, which react-compiler doesn't flag
    // as a side-effecting closure write.
    const onRender = jest.fn();
    const Counter = () => {
      useStartOfToday();
      onRender();
      return null;
    };

    render(
      <TodayProvider>
        <Counter />
      </TodayProvider>,
    );

    const baseline = onRender.mock.calls.length;

    jest.setSystemTime(new Date(2026, 4, 7, 17, 0));
    act(() => {
      captured.listener?.("active");
    });

    expect(onRender.mock.calls.length).toBe(baseline);
  });

  it("throws when used outside the provider", () => {
    const Throws = () => {
      useStartOfToday();
      return null;
    };
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Throws />)).toThrow(
      "useStartOfToday must be used within a TodayProvider",
    );
    spy.mockRestore();
  });

  describe("useCurrentEpochMinute / epochMinuteToDate", () => {
    const MinuteProbe = () => {
      const epochMinute = useCurrentEpochMinute();
      return <Text testID="minute">{String(epochMinute)}</Text>;
    };

    it("returns Math.floor(Date.now() / 60_000)", () => {
      jest.useFakeTimers();
      const t = new Date(2026, 4, 7, 14, 30, 45);
      jest.setSystemTime(t);

      const view = render(
        <TodayProvider>
          <MinuteProbe />
        </TodayProvider>,
      );

      expect(view.getByTestId("minute").props.children).toBe(
        String(Math.floor(t.getTime() / 60_000)),
      );
    });

    it("epochMinuteToDate inverts useCurrentEpochMinute (start-of-minute)", () => {
      const t = new Date(2026, 4, 7, 14, 30, 45);
      const epochMinute = Math.floor(t.getTime() / 60_000);
      const back = epochMinuteToDate(epochMinute);
      expect(back.getFullYear()).toBe(2026);
      expect(back.getMonth()).toBe(4);
      expect(back.getDate()).toBe(7);
      expect(back.getHours()).toBe(14);
      expect(back.getMinutes()).toBe(30);
      expect(back.getSeconds()).toBe(0);
      expect(back.getMilliseconds()).toBe(0);
    });
  });
});
