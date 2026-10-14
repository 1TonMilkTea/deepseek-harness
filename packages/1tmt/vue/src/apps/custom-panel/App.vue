<script setup lang="ts">
import { inject } from 'vue'
import { BRIDGE_KEY, type CustomBridge } from '../../bridge.js'

const bridge = inject<CustomBridge>(BRIDGE_KEY)
if (bridge === undefined) throw new Error('CustomBridge missing: provide via mountCustomPanel')
</script>

<template>
  <div class="tmt-custom-root" data-custom-panel>
    <el-card shadow="never">
      <h1 class="tmt-custom-title">{{ bridge.labels.title }}</h1>
      <p class="tmt-custom-intro">{{ bridge.labels.intro }}</p>
    </el-card>
  </div>
</template>
