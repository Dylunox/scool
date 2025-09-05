// Auto sync on load: ensure auth, repair data silently (no defaults, no alerts), no reload
import { userReady } from './firebase.js';
import { repairUserData } from './db.js';

(async function autoSync() {
  try {
    await userReady;
    await repairUserData();
  } catch (e) {
    console.error('Auto sync failed:', e);
  }
})();