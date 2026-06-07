import { render, fireEvent } from "@testing-library/react-native";
import { HabitActionsMenu, type HabitActionItem } from "../HabitActionsMenu";

const open = (view: Awaited<ReturnType<typeof render>>) =>
  fireEvent.press(view.getByLabelText("Habit actions"));

describe("HabitActionsMenu", () => {
  it("does not render items until opened", async () => {
    const items: HabitActionItem[] = [
      { key: "pause", label: "Pause", onPress: jest.fn() },
    ];
    const view = await render(<HabitActionsMenu items={items} />);
    expect(view.queryByText("Pause")).toBeNull();
  });

  it("renders the provided items when opened", async () => {
    const items: HabitActionItem[] = [
      { key: "pause", label: "Pause", onPress: jest.fn() },
      { key: "archive", label: "Archive", onPress: jest.fn() },
      { key: "delete", label: "Delete", onPress: jest.fn(), danger: true },
    ];
    const view = await render(<HabitActionsMenu items={items} />);
    await open(view);
    expect(view.getByText("Pause")).toBeTruthy();
    expect(view.getByText("Archive")).toBeTruthy();
    expect(view.getByText("Delete")).toBeTruthy();
  });

  it("invokes an item's onPress when selected", async () => {
    const onPress = jest.fn();
    const items: HabitActionItem[] = [
      { key: "archive", label: "Archive", onPress },
    ];
    const view = await render(<HabitActionsMenu items={items} />);
    await open(view);
    await fireEvent.press(view.getByText("Archive"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("closes the menu after an item is selected", async () => {
    const items: HabitActionItem[] = [
      { key: "archive", label: "Archive", onPress: jest.fn() },
    ];
    const view = await render(<HabitActionsMenu items={items} />);
    await open(view);
    await fireEvent.press(view.getByText("Archive"));
    expect(view.queryByText("Archive")).toBeNull();
  });

  it("does not invoke a disabled item", async () => {
    const onPress = jest.fn();
    const items: HabitActionItem[] = [
      { key: "pause", label: "Pause", onPress, disabled: true },
    ];
    const view = await render(<HabitActionsMenu items={items} />);
    await open(view);
    await fireEvent.press(view.getByText("Pause"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders an item's sub caption", async () => {
    const items: HabitActionItem[] = [
      { key: "archive", label: "Archive", sub: "hide it", onPress: jest.fn() },
    ];
    const view = await render(<HabitActionsMenu items={items} />);
    await open(view);
    expect(view.getByText("hide it")).toBeTruthy();
  });
});
