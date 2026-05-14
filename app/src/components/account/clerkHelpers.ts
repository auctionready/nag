import type { CredentialChannel, CredentialMode } from "./types";

type MaybeClerkError = {
  errors?: { code?: string; longMessage?: string; message?: string }[];
};

export const clerkErrorCode = (err: unknown): string | undefined => {
  const e = err as MaybeClerkError;
  return e?.errors?.[0]?.code;
};

export const clerkErrorMessage = (err: unknown): string | undefined => {
  const e = err as MaybeClerkError;
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message;
};

type ClerkSignIn = any;
type ClerkSignUp = any;
type ClerkSetActive = (params: { session: string }) => Promise<void>;

export const prepareCredentialFlow = async ({
  channel,
  identifier,
  signIn,
  signUp,
}: {
  channel: CredentialChannel;
  identifier: string;
  signIn: ClerkSignIn;
  signUp: ClerkSignUp;
}): Promise<CredentialMode> => {
  const strategy = channel === "email" ? "email_code" : "phone_code";
  try {
    await signIn.create({ identifier });
    const factor = signIn.supportedFirstFactors?.find(
      (f: { strategy: string }) => f.strategy === strategy,
    );
    if (!factor) {
      throw new Error(
        `${strategy} is not enabled for this Clerk instance — enable it in the Clerk dashboard`,
      );
    }
    await signIn.prepareFirstFactor(factor);
    return "sign-in";
  } catch (err) {
    if (clerkErrorCode(err) === "form_identifier_not_found") {
      // No account yet — fall through to sign-up.
    } else {
      throw new Error(clerkErrorMessage(err) ?? (err as Error).message);
    }
  }

  if (channel === "email") {
    await signUp.create({ emailAddress: identifier });
    await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
  } else {
    await signUp.create({ phoneNumber: identifier });
    await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
  }
  return "sign-up";
};

export const verifyCredentialCode = async ({
  channel,
  mode,
  code,
  signIn,
  signUp,
  setActive,
}: {
  channel: CredentialChannel;
  mode: CredentialMode;
  code: string;
  signIn: ClerkSignIn;
  signUp: ClerkSignUp;
  setActive: ClerkSetActive;
}): Promise<void> => {
  if (mode === "sign-in") {
    const strategy = channel === "email" ? "email_code" : "phone_code";
    const result = await signIn.attemptFirstFactor({ strategy, code });
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error(`sign-in incomplete (status=${result.status})`);
    }
    await setActive({ session: result.createdSessionId });
    return;
  }

  const result =
    channel === "email"
      ? await signUp.attemptEmailAddressVerification({ code })
      : await signUp.attemptPhoneNumberVerification({ code });
  if (result.status !== "complete" || !result.createdSessionId) {
    const missing = result.missingFields ?? [];
    const reason =
      missing.length > 0
        ? `Clerk requires ${missing.join(", ")} — relax sign-up requirements in the Clerk dashboard`
        : `sign-up incomplete (status=${result.status})`;
    throw new Error(reason);
  }
  await setActive({ session: result.createdSessionId });
};

export const requiredFieldMessage = (channel: CredentialChannel) =>
  channel === "email" ? "Enter your email address" : "Enter your phone number";
