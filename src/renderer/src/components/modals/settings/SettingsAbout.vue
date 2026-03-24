/** SettingsAbout — section A propos du modal Settings. */
<script setup lang="ts">
import { Info, Globe, Monitor, Heart, Github, ExternalLink } from 'lucide-vue-next'
import logoUrl from '@/assets/logo.png'
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Info :size="18" />
      <h3 class="stg-section-title">À propos</h3>
    </div>

    <div class="stg-about-hero">
      <img :src="logoUrl" class="stg-about-logo" alt="Cursus" />
      <div class="stg-about-hero-text">
        <h4 class="stg-about-name">Cursus</h4>
        <span class="stg-about-version">v0.3.1</span>
      </div>
      <p class="stg-about-tagline">Suivez votre parcours de formation</p>
    </div>

    <div class="stg-group">
      <div class="stg-group-header">
        <Globe :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Liens</h4>
      </div>
      <div class="stg-info-grid">
        <a href="https://app.cursus.school" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
          <span class="stg-info-label">Application</span>
          <span class="stg-info-value">app.cursus.school <ExternalLink :size="10" /></span>
        </a>
        <a href="https://cursus.school" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
          <span class="stg-info-label">Site web</span>
          <span class="stg-info-value">cursus.school <ExternalLink :size="10" /></span>
        </a>
      </div>
    </div>

    <div class="stg-group">
      <div class="stg-group-header">
        <Monitor :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Technique</h4>
      </div>
      <div class="stg-info-grid">
        <div class="stg-info-cell">
          <span class="stg-info-label">Plateforme</span>
          <span class="stg-info-value">Electron + Vue 3</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Base de données</span>
          <span class="stg-info-value">SQLite (local)</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Temps réel</span>
          <span class="stg-info-value">Socket.io</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Licence</span>
          <span class="stg-info-value">MIT</span>
        </div>
      </div>
    </div>

    <div class="stg-group">
      <div class="stg-group-header">
        <Heart :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Créé par</h4>
      </div>
      <div class="stg-author-card">
        <div class="stg-author-avatar">RF</div>
        <div class="stg-author-info">
          <span class="stg-author-name">Rohan Fossé</span>
          <a href="https://github.com/rohanfosse/cursus" target="_blank" rel="noopener" class="stg-author-link">
            <Github :size="12" /> Voir sur GitHub <ExternalLink :size="10" />
          </a>
        </div>
      </div>
    </div>

    <div class="stg-about-desc">
      <p>
        Plateforme pédagogique open-source combinant messagerie en temps réel,
        suivi des devoirs et rendus, gestion documentaire et planification Gantt.
        Tout en un seul endroit.
      </p>
    </div>
  </section>
</template>
