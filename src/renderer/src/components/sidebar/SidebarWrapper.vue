/**
 * SidebarWrapper — Routes between teacher Sidebar and student SidebarStudent
 * based on appStore.isStaff.
 */
<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import Sidebar from './Sidebar.vue'
import SidebarStudent from './SidebarStudent.vue'

const appStore = useAppStore()
</script>

<template>
  <Sidebar v-if="appStore.isStaff" />
  <SidebarStudent v-else />
</template>
