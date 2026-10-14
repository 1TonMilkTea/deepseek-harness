<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from 'vue'
import { BRIDGE_KEY, type LoginBridge, type LoginOrganization } from '../../bridge.js'

const bridge = inject<LoginBridge>(BRIDGE_KEY)
if (bridge === undefined) throw new Error('LoginBridge missing: provide via mountLogin')

type Phase = 'loading' | 'backend' | 'login'

const phase = ref<Phase>('loading')
const baseUrlDraft = ref('')
const organizations = ref<readonly LoginOrganization[]>([])
const orgId = ref<number | undefined>(undefined)
const staffNumber = ref('')
const wmsPassword = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

let cancelled = false

onMounted(() => {
  cancelled = false
  void bootstrap()
})

onUnmounted(() => {
  cancelled = true
})

async function bootstrap(): Promise<void> {
  const current = await bridge.status()
  if (cancelled) return
  if (!current.ok) {
    error.value = current.error.message
    phase.value = 'backend'
    return
  }
  if (current.value.loggedIn) {
    await bridge.refreshSessions()
    if (cancelled) return
    bridge.onLoggedIn()
    return
  }
  const backend = await bridge.getBackendConfig()
  if (cancelled) return
  if (!backend.ok) {
    error.value = backend.error.message
    phase.value = 'backend'
    return
  }
  baseUrlDraft.value = backend.value.baseUrl
  if (!backend.value.configured) {
    phase.value = 'backend'
    return
  }
  const listed = await bridge.listOrganizations()
  if (cancelled) return
  if (!listed.ok) {
    error.value = listed.error.message
    phase.value = 'backend'
    return
  }
  organizations.value = listed.value.organizations
  phase.value = 'login'
}

async function onBackendSubmit(): Promise<void> {
  const next = baseUrlDraft.value.trim()
  if (next === '') return
  busy.value = true
  error.value = null
  const saved = await bridge.setBackendConfig({ baseUrl: next })
  if (cancelled) return
  if (!saved.ok) {
    busy.value = false
    error.value = saved.error.message
    return
  }
  baseUrlDraft.value = saved.value.baseUrl
  const listed = await bridge.listOrganizations()
  if (cancelled) return
  busy.value = false
  if (!listed.ok) {
    error.value = listed.error.message
    return
  }
  organizations.value = listed.value.organizations
  phase.value = 'login'
}

async function onLoginSubmit(): Promise<void> {
  const id = orgId.value
  if (id === undefined || !Number.isFinite(id) || staffNumber.value.trim() === '' || wmsPassword.value === '') {
    return
  }
  busy.value = true
  error.value = null
  const result = await bridge.wmsLogin({
    orgId: id,
    staffNumber: staffNumber.value.trim(),
    wmsPassword: wmsPassword.value,
  })
  if (cancelled) return
  if (!result.ok) {
    busy.value = false
    error.value = result.error.message
    return
  }
  await bridge.refreshSessions()
  if (cancelled) return
  busy.value = false
  bridge.onLoggedIn()
}

function openBackend(): void {
  error.value = null
  phase.value = 'backend'
}
</script>

<template>
  <div
    v-if="phase === 'loading'"
    class="tmt-login-gate"
    role="status"
  >
    <span class="tmt-login-loading">{{ bridge.labels.loading }}</span>
  </div>

  <div
    v-else-if="phase === 'backend'"
    class="tmt-login-gate"
    role="dialog"
    aria-labelledby="tmt-backend-title"
  >
    <el-card class="tmt-login-card" shadow="always">
      <h1 id="tmt-backend-title" class="tmt-login-title">{{ bridge.labels.backendTitle }}</h1>
      <p class="tmt-login-subtitle">{{ bridge.labels.backendSubtitle }}</p>
      <el-form @submit.prevent="onBackendSubmit">
        <div class="tmt-login-field">
          <el-form-item :label="bridge.labels.backendUrl">
            <el-input
              v-model="baseUrlDraft"
              :disabled="busy"
              autocomplete="url"
              :placeholder="bridge.labels.backendUrlPlaceholder"
            />
          </el-form-item>
        </div>
        <el-alert
          v-if="error !== null"
          :title="error"
          type="error"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
        />
        <div class="tmt-login-actions">
          <el-button
            type="primary"
            native-type="submit"
            :loading="busy"
            :disabled="busy"
          >
            {{ bridge.labels.backendSubmit }}
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>

  <div
    v-else
    class="tmt-login-gate"
    role="dialog"
    aria-labelledby="tmt-login-title"
  >
    <el-card class="tmt-login-card" shadow="always">
      <h1 id="tmt-login-title" class="tmt-login-title">{{ bridge.labels.title }}</h1>
      <p class="tmt-login-subtitle">{{ bridge.labels.subtitle }}</p>
      <el-form @submit.prevent="onLoginSubmit">
        <div class="tmt-login-field">
          <el-form-item :label="bridge.labels.org">
            <el-select
              v-model="orgId"
              :disabled="busy"
              :placeholder="bridge.labels.orgPlaceholder"
              style="width: 100%"
            >
              <el-option
                v-for="organization in organizations"
                :key="organization.id"
                :label="organization.name"
                :value="organization.id"
              />
            </el-select>
          </el-form-item>
        </div>
        <div class="tmt-login-field">
          <el-form-item :label="bridge.labels.staffNumber">
            <el-input
              v-model="staffNumber"
              :disabled="busy"
              autocomplete="username"
              :placeholder="bridge.labels.staffNumberPlaceholder"
            />
          </el-form-item>
        </div>
        <div class="tmt-login-field">
          <el-form-item :label="bridge.labels.password">
            <el-input
              v-model="wmsPassword"
              type="password"
              show-password
              :disabled="busy"
              autocomplete="current-password"
              :placeholder="bridge.labels.passwordPlaceholder"
            />
          </el-form-item>
        </div>
        <el-alert
          v-if="error !== null"
          :title="error"
          type="error"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
        />
        <div class="tmt-login-actions">
          <el-button
            type="primary"
            native-type="submit"
            :loading="busy"
            :disabled="busy"
          >
            {{ bridge.labels.submit }}
          </el-button>
          <el-button
            text
            type="primary"
            :disabled="busy"
            @click="openBackend"
          >
            {{ bridge.labels.editBackend }}
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>
