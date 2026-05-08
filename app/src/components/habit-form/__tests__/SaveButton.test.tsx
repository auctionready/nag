import { render, fireEvent } from "@testing-library/react-native";
import { SaveButton } from "../SaveButton";

describe("SaveButton", () => {
  it("renders default 'save' label", () => {
    const { getByText } = render(<SaveButton onPress={() => {}} />);
    expect(getByText("save")).toBeTruthy();
  });

  it("renders custom label when provided", () => {
    const { getByText } = render(
      <SaveButton onPress={() => {}} label="start nagging me" />,
    );
    expect(getByText("start nagging me")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(<SaveButton onPress={onPress} label="go" />);
    fireEvent.press(getByText("go"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
