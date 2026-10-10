import { Amplify } from 'aws-amplify'
import * as A from 'aws-amplify/auth'

Amplify.configure({
  Auth: { Cognito: {
    userPoolId: import.meta.env.VITE_USER_POOL_ID as string,
    userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID as string,
    loginWith: { email: true },
  } },
})

export const auth = {
  signIn: (email: string, password: string) => A.signIn({ username: email, password }),
  signUp: (email: string, password: string) => A.signUp({ username: email, password, options: { userAttributes: { email } } }),
  confirmSignUp: (email: string, code: string) => A.confirmSignUp({ username: email, confirmationCode: code }),
  resendCode: (email: string) => A.resendSignUpCode({ username: email }),
  resetPassword: (email: string) => A.resetPassword({ username: email }),
  confirmReset: (email: string, code: string, password: string) =>
    A.confirmResetPassword({ username: email, confirmationCode: code, newPassword: password }),
  signOut: () => A.signOut(),
  async currentEmail(): Promise<string | null> {
    try { await A.getCurrentUser(); return (await A.fetchUserAttributes()).email ?? '' } catch { return null }
  },
  async accessToken(): Promise<string | null> {
    try { return (await A.fetchAuthSession()).tokens?.accessToken?.toString() ?? null } catch { return null }
  },
}

/** Cognito error names -> words a homeowner understands. */
export function authMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? ''
  const map: Record<string, string> = {
    NotAuthorizedException: 'Email or password is wrong.',
    UserNotFoundException: 'Email or password is wrong.',
    UsernameExistsException: 'An account with this email already exists. Log in instead.',
    InvalidPasswordException: 'Use at least 8 characters, with a lowercase letter and a number.',
    CodeMismatchException: 'That code is not right. Check the email and try again.',
    ExpiredCodeException: 'That code has expired. Ask for a new one.',
    LimitExceededException: 'Too many attempts. Wait a few minutes and try again.',
    UserNotConfirmedException: 'Confirm your email first — we sent you a code.',
    EmptySignInUsername: 'Enter your email.',
    EmptySignInPassword: 'Enter your password.',
  }
  return map[name] ?? (e as Error)?.message ?? 'Something went wrong. Please try again.'
}
