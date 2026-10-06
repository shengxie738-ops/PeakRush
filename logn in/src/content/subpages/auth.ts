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
 * Everything below this line is local-demo behaviour: no request, no storage, no
 * OAuth. The reference's Facebook / Google buttons and the Google-Places-backed
 * country picker are reproduced as inert, marked regions — their API keys belong
 * to the operator and are deliberately not copied.
 */

export const AUTH_SPLIT = {
  /** `.layout-split__bg` theme + the copy inside the sticky decoration. */
  theme: 'ui-green',
  heading: 'FollowArt',
  lines: ['Webby-awarded', 'digital infrastructure', 'for artists and curators'],
  /** /signup paints a different promise on the same panel. */
  signupLines: ['Create your profile to showcase your practice and receive direct financial support'],
  /** The panel's word art is an inline SVG + a WebGL canvas: not reproduced. */
  wordmarkAvailable: false,
} as const;

export const FORM_TABS = {
  /** `.btn-group` measured on both pages; the active item carries --active. */
  items: [
    { label: 'Join', to: '/signup' },
    { label: 'Login', to: '/signin' },
  ] as const,
  activeClass: 'btn-group__item--active',
} as const;

export const OAUTH_PROVIDERS = [
  { id: 'facebook', label: 'Facebook', icon: 'login-facebook' },
  { id: 'google', label: 'Google', icon: 'login-google' },
] as const;

/** Measured field rows of /signin. */
export const SIGNIN_FIELDS = [
  { name: 'username', type: 'email', label: 'Email', required: true, autocomplete: 'username' },
  { name: 'password', type: 'password', label: 'Password', required: true, autocomplete: 'current-password' },
] as const;

export const SIGNIN_COPY = {
  path: '/signin',
  heading: 'Login',
  tab: 'Login',
  orEmail: 'or login with e-mail',
  remember: 'Remember me for 24 hours',
  forgot: 'I forgot my password',
  submit: 'Login',
  footerHint: 'Not registered yet? Join',
  /** The reference header on these two routes is `.header`, not `.promo-header`. */
  notice: 'Local clone demo — nothing you type leaves the page, is sent anywhere or is stored.',
} as const;

/** Measured step 1 of /signup. */
export const SIGNUP_STEP1 = {
  heading: 'Join',
  orEmail: 'or join with e-mail',
  fields: [
    { name: 'username', type: 'email', label: 'Email', required: true, autocomplete: 'username' },
    { name: 'password', type: 'password', label: 'Password (8 characters min)', required: true, autocomplete: 'new-password' },
  ] as const,
  agreements: [
    { name: 'agreeTerms', label: 'I agree to the', linkA: 'Terms and Conditions', hrefA: '/terms-and-conditions', linkB: 'Privacy Policy', hrefB: '/privacy-policy', required: true },
    { name: 'newsletter', label: 'Subscribe to FOLLOW.ART’s newsletter', linkA: '', hrefA: '', linkB: '', hrefB: '', required: false },
  ] as const,
  submit: 'Continue',
  stepLabel: (of: number): string => `Step 1 of ${of}`,
} as const;

/**
 * Measured step 2 of /signup ("Tell about yourself"): role radio pair, name pair,
 * country picker, phone, avatar. The reference country list is the ISO name list
 * with dial codes (240+ entries, e.g. "+371 Latvia"); it is a data file the asset
 * pass never captured, so the picker is rendered as a marked pending control
 * rather than a fabricated list.
 */
export const SIGNUP_STEP2 = {
  heading: 'Tell about yourself',
  roles: ["I'm Artist", "I'm Curator"] as const,
  roleGroupName: 'type',
  fields: [
    { name: 'firstName', type: 'text', label: 'First name', required: true, maxlength: 50 },
    { name: 'lastName', type: 'text', label: 'Last name', required: true, maxlength: 50 },
    { name: 'phone', type: 'tel', label: 'Phone', required: false, maxlength: 20 },
  ] as const,
  countryHeading: 'Country',
  countrySearchLabel: 'Country or Country code',
  countryAvailable: false,
  avatarLabel: 'Avatar',
  submit: 'Create account',
  stepLabel: (of: number): string => `Step 2 of ${of}`,
} as const;

export const SIGNUP_NEWSLETTER_LABEL = 'Subscribe to FOLLOW.ART’s newsletter';
export const SIGNUP_TERMS_LABEL = 'I agree to the Terms and Conditions and Privacy Policy';
