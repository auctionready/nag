import { render, fireEvent } from "@testing-library/react-native";
import { SaveButton } from "../SaveButton";

describe("SaveButton", () => {
  it("renders default 'save' label", async () => {
    const { getByText } = await render(<SaveButton onPress={() => {}} />);
    expect(getByText("save")).toBeTruthy();
  });

  it("renders custom label when provided", async () => {
    const { getByText } = await render(
      <SaveButton onPress={() => {}} label="start nagging me" />,
    );
    expect(getByText("start nagging me")).toBeTruthy();
  });

  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <SaveButton onPress={onPress} label="go" />,
    );
    await fireEvent.press(getByText("go"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
