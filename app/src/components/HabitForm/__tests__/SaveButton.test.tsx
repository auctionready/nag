import { render, fireEvent } from "@testing-library/react-native";
import { SaveButton } from "../SaveButton";

describe("SaveButton", () => {
  it("renders Save label", () => {
    const { getByText } = render(<SaveButton onPress={() => {}} />);
    expect(getByText("Save")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(<SaveButton onPress={onPress} />);
    fireEvent.press(getByText("Save"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
