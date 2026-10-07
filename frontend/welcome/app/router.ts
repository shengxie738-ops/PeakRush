/**
 * router.ts — the 12 internal routes of docs/DOM_CONTRACT.md, plus a catch-all
 * that renders the reference error page (PageError, Bi84onXO.js: ui-orange
 * intro-layout error-layout with the "Page Not Found" glyph word and a
 * "Go to homepage" CTA).
 *
 * Scroll behaviour lives in the .scrollable__area element (reference-lock.json
 * scrollModel: container "DIV.scrollable__area.lenis", windowScrollUsable false),
 * so the router itself never touches window.scroll.
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { ROUTE_MANIFEST } from './routeManifest';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/HomePage.vue'),
    meta: { theme: 'orange', headerExpanded: true, title: ROUTE_MANIFEST[0].title },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/pages/AboutPage.vue'),
    meta: { theme: 'pink', title: ROUTE_MANIFEST[1].title },
  },
  {
    path: '/our-product',
    name: 'our-product',
    component: () => import('@/pages/ProductPage.vue'),
    meta: { theme: 'orange', title: ROUTE_MANIFEST[2].title },
  },
  {
    path: '/community-board',
    name: 'community-board',
    component: () => import('@/pages/CommunityPage.vue'),
    meta: { theme: 'light', title: ROUTE_MANIFEST[3].title },
  },
  {
    path: '/pricing',
    name: 'pricing',
    component: () => import('@/pages/PricingPage.vue'),
    meta: { theme: 'pink', title: ROUTE_MANIFEST[4].title },
  },
  {
    path: '/faq',
    name: 'faq',
    component: () => import('@/pages/FaqPage.vue'),
    meta: { theme: 'green', title: ROUTE_MANIFEST[5].title },
  },
  {
    path: '/signin',
    name: 'signin',
    component: () => import('@/pages/SignInPage.vue'),
    meta: { theme: 'light', localDemo: true, title: ROUTE_MANIFEST[6].title },
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('@/pages/SignUpPage.vue'),
    meta: { theme: 'orange', localDemo: true, title: ROUTE_MANIFEST[7].title },
  },
  {
    path: '/gift-card',
    name: 'gift-card',
    component: () => import('@/pages/GiftCardPage.vue'),
    meta: { theme: 'orange', localDemo: true, title: ROUTE_MANIFEST[8].title },
  },
  {
    path: '/terms-and-conditions',
    name: 'terms-and-conditions',
    component: () => import('@/pages/LegalPage.vue'),
    props: { document: 'terms-and-conditions' },
    meta: { theme: 'pink', title: ROUTE_MANIFEST[9].title },
  },
  {
    path: '/privacy-policy',
    name: 'privacy-policy',
    component: () => import('@/pages/LegalPage.vue'),
    props: { document: 'privacy-policy' },
    meta: { theme: 'green', title: ROUTE_MANIFEST[10].title },
  },
  {
    path: '/cookies-policy',
    name: 'cookies-policy',
    component: () => import('@/pages/LegalPage.vue'),
    props: { document: 'cookies-policy' },
    meta: { theme: 'pink', title: ROUTE_MANIFEST[11].title },
  },
  {
    path: '/:catchAll(.*)',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
    meta: { theme: 'orange', notFound: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  /* the scroll container is not the window, so the default scrollBehaviour has to
     be disabled; the reference restores no position either (Lenis owns it). */
  scrollBehavior: () => false,
});

export default router;
