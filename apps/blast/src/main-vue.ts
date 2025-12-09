import { createApp } from 'vue';
import Test from './vue/test.vue';

const vueRoot = document.getElementById('vue-root');
if (vueRoot) {
  createApp(Test).mount(vueRoot);
}

