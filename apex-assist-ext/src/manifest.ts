// MV3 manifest (typed via TS) for CRX plugin
export default {
  manifest_version: 3 as const,
  name: 'Apex Assist (Vite)'.trim(),
  version: '0.1.0',
  description: 'Apex Assist extension scaffolded via Vite + React + TS + CRX.',
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module' as const,
  },
  content_scripts: [
    {
      matches: [
        '*://*.course.apexlearning.com/*',
        '*://*.apexvs.com/*',
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle' as const,
    },
  ],
  permissions: [
    'storage',
    'activeTab',
    'tabs',
  ],
  commands: {
    'toggle-automation': {
      suggested_key: {
        default: 'Ctrl+Shift+A',
        mac: 'Command+Shift+A',
      },
      description: 'Toggle automation on/off',
    },
  },
  host_permissions: [
    '*://*.course.apexlearning.com/*',
    '*://*.apexvs.com/*',
  ],
} satisfies chrome.runtime.ManifestV3;
