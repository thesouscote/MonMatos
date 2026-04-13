<script setup lang="ts">
import { ref } from 'vue'

const message = ref('')
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function show(msg: string) {
  message.value = msg
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { visible.value = false }, 2800)
}

defineExpose({ show })
</script>

<template>
  <div class="toast" :class="{ show: visible }">{{ message }}</div>
</template>
