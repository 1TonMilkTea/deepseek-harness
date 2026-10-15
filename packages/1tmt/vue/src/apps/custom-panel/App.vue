<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { inject } from 'vue'
import { BRIDGE_KEY, type CustomBridge } from '../../bridge.js'

const bridge = inject<CustomBridge>(BRIDGE_KEY)
if (bridge === undefined) throw new Error('CustomBridge missing: provide via mountCustomPanel')

const status = ref('')

async function publishDemo(): Promise<void> {
  const result = await bridge.publishSnapshot({
    kind: 'list',
    title: bridge.labels.title,
    rows: [
      { id: 1, name: 'demo-row-a', qty: 10 },
      { id: 2, name: 'demo-row-b', qty: 20 },
    ],
  })
  status.value = result.ok
    ? `published hash=${result.value.hash}`
    : `publish failed: ${result.error.message}`
}

onMounted(() => {
  void publishDemo()
})

onUnmounted(() => {
  void bridge.clearSnapshot()
})
</script>

<template>
  <div class="tmt-custom-root" data-custom-panel>
    <el-card shadow="never">
      <h1 class="tmt-custom-title">{{ bridge.labels.title }}</h1>
      <p class="tmt-custom-intro">{{ bridge.labels.intro }}</p>
      <p class="tmt-custom-status" data-custom-panel-status>{{ status }}</p>
      <el-button type="primary" @click="publishDemo">
        {{ bridge.labels.republish }}
      </el-button>
    </el-card>
  </div>
</template>
