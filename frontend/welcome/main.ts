import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app/App.vue';
import router from './app/router';

import './styles/reset.css';
import './styles/tokens.css';
import './styles/typography.css';
import './styles/layout.css';
/* CLONE-LOCAL cascade order: home-overrides.css must be the LAST stylesheet so its
   `@layer base` print-leak repair lands after tokens.css's unguarded print block. */
import './styles/home-overrides.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
