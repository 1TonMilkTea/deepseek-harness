<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { inject } from 'vue'
import { BRIDGE_KEY, type CustomWorkbenchBridge } from '../../bridge.js'

const bridge = inject<CustomWorkbenchBridge>(BRIDGE_KEY)
if (bridge === undefined) throw new Error('CustomWorkbenchBridge missing: provide via mountCustomWorkbench')

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
  <div class="tmt-workbench-root" data-custom-workbench>
    <el-card shadow="never">
      <h1 class="tmt-workbench-title">{{ bridge.labels.title }}</h1>
      <p class="tmt-workbench-intro">{{ bridge.labels.intro }}</p>
      <p class="tmt-workbench-status" data-custom-workbench-status>{{ status }}</p>
      <el-button type="primary" @click="publishDemo">
        {{ bridge.labels.republish }}
      </el-button>
    </el-card>
  </div>
</template>
