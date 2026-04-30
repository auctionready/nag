import { useState, useEffect } from "react";

export const useShowSplash = ({
  fontsLoaded,
  minShowMs,
}: {
  fontsLoaded: boolean;
  minShowMs: number;
}): boolean => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!fontsLoaded) return;
    const t = setTimeout(() => setShow(false), minShowMs);
    return () => clearTimeout(t);
  }, [fontsLoaded, minShowMs]);

  return show;
};
