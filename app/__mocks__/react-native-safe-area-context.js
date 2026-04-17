const mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const mockFrame = { x: 0, y: 0, width: 375, height: 812 };

module.exports = {
  useSafeAreaInsets: () => mockInsets,
  useSafeAreaFrame: () => mockFrame,
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  SafeAreaConsumer: ({ children }) => children(mockInsets),
  initialWindowMetrics: { insets: mockInsets, frame: mockFrame },
};
