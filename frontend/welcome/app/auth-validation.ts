/**
 * Client-side mirror of the single validation guard in Auth.java:30, which runs BEFORE
 * the register branch and therefore applies to login and signup alike:
 *
 *   !name.matches("[A-Za-z0-9_]{3,40}")
 *     || password.length() < 8
 *     || password.getBytes(UTF_8).length > 72
 *
 * The username pattern admits no '@' or '.', which is why the field is type="text" and
 * not the reference's type="email" — a browser would block a legitimate username like
 * admin_01 before it ever reached us.
 *
 * The password floor is 8, not the 6 that AuthDialog.vue used to check. That mismatch
 * pre-dated this work: a 6-character password passed the old dialog and was then
 * rejected by the backend.
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,40}$/;
export const PASSWORD_MIN_CHARS = 8;
export const PASSWORD_MAX_BYTES = 72;

export type FieldName = 'username' | 'password' | 'confirm';
export type FieldErrors = Partial<Record<FieldName, string>>;

export interface CredentialInput {
  username: string;
  password: string;
  confirm?: string;
}

export function passwordByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validateCredentials(
  input: CredentialInput,
  mode: 'signin' | 'signup',
): FieldErrors {
  const errors: FieldErrors = {};
  const username = input.username.trim();

  if (!USERNAME_PATTERN.test(username)) {
    errors.username = '用户名须为 3–40 位字母、数字或下划线。';
  }
  if (input.password.length < PASSWORD_MIN_CHARS) {
    errors.password = `密码至少需要 ${PASSWORD_MIN_CHARS} 个字符。`;
  } else if (passwordByteLength(input.password) > PASSWORD_MAX_BYTES) {
    errors.password = `密码长度不能超过 ${PASSWORD_MAX_BYTES} 字节。`;
  }
  if (mode === 'signup' && input.confirm !== input.password) {
    errors.confirm = '两次输入的密码不一致。';
  }
  return errors;
}
