<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Delete } from 'lucide-vue-next'

const props = defineProps<{
  error?: boolean;
}>()

const emit = defineEmits<{
  submit: [pin: string];
  cancel: [];
}>()

const pin = ref('')

function press(num: string) {
  if (pin.value.length < 4) {
    pin.value += num
    if (pin.value.length === 4) {
      // Auto-submit when 4 digits are entered
      emit('submit', pin.value)
      // reset later if error (handled by parent changing error prop we could watch, or parent remounts)
      setTimeout(() => { if(props.error) pin.value = '' }, 500)
    }
  }
}

function backspace() {
  pin.value = pin.value.slice(0, -1)
}

function clear() {
  pin.value = ''
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key >= '0' && e.key <= '9') {
    press(e.key)
  } else if (e.key === 'Backspace') {
    backspace()
  } else if (e.key === 'Escape') {
    emit('cancel')
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

defineExpose({ clear })
</script>

<template>
  <div class="pinpad">
    <div class="pin-display" :class="{ error: props.error }">
      <div v-for="i in 4" :key="i" class="pin-dot" :class="{ filled: pin.length >= i }"></div>
    </div>
    
    <div class="pin-keys">
      <button v-for="n in [1,2,3,4,5,6,7,8,9]" :key="n" class="pin-key" @click="press(n.toString())">
        {{ n }}
      </button>
      <button class="pin-key btn-action" @click="emit('cancel')">Annuler</button>
      <button class="pin-key" @click="press('0')">0</button>
      <button class="pin-key btn-action" @click="backspace"><Delete :size="24" /></button>
    </div>
  </div>
</template>

<style scoped>
.pinpad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  max-width: 300px;
  margin: 0 auto;
}

.pin-display {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.pin-display.error {
  animation: shake 0.4s ease;
}

.pin-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--text3);
  transition: all 0.2s;
}

.pin-dot.filled {
  background-color: var(--accent);
  border-color: var(--accent);
  transform: scale(1.2);
}

.pin-display.error .pin-dot.filled {
  background-color: var(--danger);
  border-color: var(--danger);
}

.pin-keys {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  width: 100%;
}

.pin-key {
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  font-size: 28px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.1s;
}

.pin-key:active {
  background: var(--border);
  transform: scale(0.95);
}

.pin-key.btn-action {
  font-size: 14px;
  font-weight: 600;
  color: var(--text3);
  background: transparent;
  border-color: transparent;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
</style>
