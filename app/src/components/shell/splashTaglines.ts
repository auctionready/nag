export type SplashTagline = {
  quote: string;
  attribution: string;
};

export const splashTaglines: ReadonlyArray<SplashTagline> = [
  {
    quote: "We are what we repeatedly do.",
    attribution: "Will Durant",
  },
  {
    quote: "While we are postponing, life speeds by.",
    attribution: "Seneca",
  },
  {
    quote: "Waste no more time arguing what a good person should be. Be one.",
    attribution: "Marcus Aurelius",
  },
  {
    quote:
      "First say to yourself what you would be; then do what you have to do.",
    attribution: "Epictetus",
  },
  {
    quote: "Confine yourself to the present.",
    attribution: "Marcus Aurelius",
  },
  {
    quote: "How long will you wait before you demand the best of yourself?",
    attribution: "Epictetus",
  },
  {
    quote: "The unexamined life is not worth living.",
    attribution: "Socrates",
  },
  {
    quote: "Knowing yourself is the beginning of all wisdom.",
    attribution: "Aristotle",
  },
  {
    quote: "We suffer more in imagination than in reality.",
    attribution: "Seneca",
  },
  {
    quote: "He who has a why can bear almost any how.",
    attribution: "Nietzsche",
  },
  {
    quote: "No man ever steps in the same river twice.",
    attribution: "Heraclitus",
  },
  {
    quote:
      "The chains of habit are too light to be felt until they are too heavy to be broken.",
    attribution: "Samuel Johnson",
  },
  {
    quote: "Begin at once to live, and count each day as a separate life.",
    attribution: "Seneca",
  },
  {
    quote:
      "It is not that we have a short time to live, but that we waste much of it.",
    attribution: "Seneca",
  },
  {
    quote: "Excellence is never an accident.",
    attribution: "Aristotle",
  },
];

let lastTagline: SplashTagline | null = null;

export const pickSplashTagline = (): SplashTagline => {
  const picked =
    splashTaglines[Math.floor(Math.random() * splashTaglines.length)];
  lastTagline = picked;
  return picked;
};

export const getLastSplashTagline = (): SplashTagline | null => lastTagline;
