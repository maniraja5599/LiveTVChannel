import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.livetv.jiotvgo',
  appName: 'JioTV Go',
  webDir: 'dist',
  server: {
    url: 'https://livetvchannel-production.up.railway.app/',
    cleartext: true
  }
};

export default config;
