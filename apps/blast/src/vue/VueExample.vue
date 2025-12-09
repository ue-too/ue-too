<template>
  <div class="vue-example">
    <h2>Vue Component Example</h2>
    <p>Count: {{ count }}</p>
    <button @click="increment">Increment</button>
    <button @click="decrement">Decrement</button>
  </div>
  <span>test string {{ test }}</span>

</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  test: string
}>();

const count = ref(0)

const increment = () => {
  count.value++
}

const decrement = () => {
  count.value--
}
</script>

<style scoped>
.vue-example {
  padding: 1rem;
  border: 2px solid #42b983;
  border-radius: 8px;
  margin: 1rem 0;
}

.vue-example h2 {
  color: #42b983;
  margin-top: 0;
}

.vue-example button {
  margin: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.vue-example button:hover {
  background-color: #35a372;
}
</style>

