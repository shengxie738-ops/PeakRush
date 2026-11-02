/**
 * auth.ts — /signin and /signup.
 *
 * Both routes are client-rendered: the SSR is a 7.5KB shell with no headings. The
 * DOM below was captured from the HYDRATED pages in the in-app browser
 * (2026-09-30, 1376x772). Neither route is behind a redirect and both render a
 * real form, so the clone reproduces the measured structure instead of
 * recording AUTH_BLOCKED.
 *
 * Measured shell:
 *   <div class="sign-in-form|sign-up-form">
 *     <div class="layout-split row layout-split--mobile-background">
 *       <div class="… layout-split__bg col--6:md ui-green">  sticky decoration side
 *       <div class="… layout-split__overlay-container col--6:md ui-light">
 *         <div class="layout-split__content"><div class="section">…form…</div></div>
 *         <div class="layout-split__footer">…</div>
 * Geometry measured at 1376x772: split 688 / 688, form column 427px wide starting
 * at x=819, no page scroll (containerScrollHeight = 772).
 *
 * AuthPanel uses the PeakRush username/password API and shares its bearer session
 * with the business entry. Reference-only profile and provider data below is
 * retained for documentation; those unsupported controls are not rendered.
 */

export const AUTH_SPLIT = {
  /** `.layout-split__bg` theme + the copy inside the sticky decoration. */
  theme: 'ui-green',
  heading: 'PeakRush',
  lines: ['好物准点开抢', '让热爱与好价相遇'],
  /** /signup paints a different promise on the same panel. */
  signupLines: ['好物准点开抢', '让热爱与好价相遇'],
  /** The panel's word art is an inline SVG + a WebGL canvas: not reproduced. */
  wordmarkAvailable: false,
} as const;

export const FORM_TABS = {
  /** `.btn-group` measured on both pages; the active item carries --active. */
  items: [
    { label: '注册', to: '/signup' },
    { label: '登录', to: '/signin' },
  ] as const,
  activeClass: 'btn-group__item--active',
} as const;

export const OAUTH_PROVIDERS = [
  { id: 'facebook', label: 'Facebook', icon: 'login-facebook' },
  { id: 'google', label: 'Google', icon: 'login-google' },
] as const;

/** Field rows of /signin. `type` and `label` depart from the measured reference on
 *  purpose: Auth.java:30 requires `[A-Za-z0-9_]{3,40}`, which admits no '@' or '.',
 *  so an email input would block a legitimate username like admin_01 before submit,
 *  and an "Email" label would tell the user to type something the backend rejects. */
export const SIGNIN_FIELDS = [
  { name: 'username', type: 'text', label: '用户名', required: true, autocomplete: 'username' },
  { name: 'password', type: 'password', label: '密码', required: true, autocomplete: 'current-password' },
] as const;

export const SIGNIN_COPY = {
  path: '/signin',
  heading: '登录',
  tab: '登录',
  orEmail: '使用 PeakRush 账号登录',
  remember: '保持登录状态',
  forgot: '忘记密码',
  submit: '登录',
  footerHint: '还没有账号？注册',
  /** The reference header on these two routes is `.header`, not `.promo-header`. */
  notice: '登录后，继续你的抢购之旅。',
} as const;

/** Measured step 1 of /signup. */
export const SIGNUP_STEP1 = {
  heading: '注册',
  orEmail: '创建你的 PeakRush 账号',
  fields: [
    { name: 'username', type: 'text', label: '用户名', required: true, autocomplete: 'username' },
    { name: 'password', type: 'password', label: '密码（至少 8 位）', required: true, autocomplete: 'new-password' },
  ] as const,
  agreements: [
    { name: 'agreeTerms', label: '我已阅读', linkA: '平台使用规则', hrefA: '/terms-and-conditions', linkB: '隐私说明', hrefB: '/privacy-policy', required: true },
    { name: 'newsletter', label: '关注 PeakRush 活动预告', linkA: '', hrefA: '', linkB: '', hrefB: '', required: false },
  ] as const,
  submit: '注册',
  stepLabel: (of: number): string => `第 1 步，共 ${of} 步`,
} as const;

/**
 * Measured step 2 of /signup ("Tell about yourself"): role radio pair, name pair,
 * country picker, phone, avatar. The reference country list is the ISO name list
 * with dial codes (240+ entries, e.g. "+371 Latvia"); it is a data file the asset
 * pass never captured, so the picker is rendered as a marked pending control
 * rather than a fabricated list.
 */
export const SIGNUP_STEP2 = {
  heading: '完善账号信息',
  roles: ['发现好物', '关注活动'] as const,
  roleGroupName: 'type',
  fields: [
    { name: 'firstName', type: 'text', label: '名字', required: true, maxlength: 50 },
    { name: 'lastName', type: 'text', label: '姓氏', required: true, maxlength: 50 },
    { name: 'phone', type: 'tel', label: '联系电话', required: false, maxlength: 20 },
  ] as const,
  countryHeading: '国家或地区',
  countrySearchLabel: '国家或地区名称',
  countryAvailable: false,
  avatarLabel: '头像',
  submit: '创建账号',
  stepLabel: (of: number): string => `第 2 步，共 ${of} 步`,
} as const;

export const SIGNUP_NEWSLETTER_LABEL = '关注 PeakRush 活动预告';
export const SIGNUP_TERMS_LABEL = '我已阅读平台使用规则和隐私说明';
