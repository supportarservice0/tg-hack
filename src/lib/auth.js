import { ref, get, set } from "firebase/database";
import { db } from "./firebase";

const ADMIN_CONFIG_PATH = "admin_config";
const SESSION_KEY = "lexxa_admin_session";
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours of validity

// Default fallback credentials if none exist in Firebase yet
const DEFAULT_CREDENTIALS = {
  adminId: "admin",
  adminPass: "admin123",
  updatedAt: 0
};

/**
 * Fetch current admin credentials from Firebase RTDB.
 * If not yet initialized, initializes default credentials in Firebase.
 */
export async function getAdminConfig() {
  try {
    const snapshot = await get(ref(db, ADMIN_CONFIG_PATH));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const currentConfig = {
        adminId: data.adminId || DEFAULT_CREDENTIALS.adminId,
        adminPass: data.adminPass || DEFAULT_CREDENTIALS.adminPass,
        updatedAt: data.updatedAt || 0
      };
      // If updatedAt was never set in DB, set it now
      if (!data.updatedAt) {
        const initTime = Date.now();
        currentConfig.updatedAt = initTime;
        await set(ref(db, ADMIN_CONFIG_PATH), currentConfig);
      }
      return currentConfig;
    } else {
      // First time initialization in Firebase
      const initTime = Date.now();
      await set(ref(db, ADMIN_CONFIG_PATH), {
        adminId: DEFAULT_CREDENTIALS.adminId,
        adminPass: DEFAULT_CREDENTIALS.adminPass,
        updatedAt: initTime
      });
      return {
        ...DEFAULT_CREDENTIALS,
        updatedAt: initTime
      };
    }
  } catch (error) {
    console.warn("Could not reach Firebase for admin_config, using fallback:", error);
    return DEFAULT_CREDENTIALS;
  }
}

/**
 * Verify provided admin credentials against Firebase RTDB.
 * Returns { valid: true, adminId, authEpoch } or { valid: false }.
 */
export async function verifyAdminCredentials(inputAdminId, inputPassword) {
  if (!inputAdminId || !inputPassword) return { valid: false };
  const config = await getAdminConfig();
  const idMatch = config.adminId.trim().toLowerCase() === inputAdminId.trim().toLowerCase();
  const passMatch = String(config.adminPass) === String(inputPassword);

  if (idMatch && passMatch) {
    let epoch = config.updatedAt;
    if (!epoch || epoch === 0) {
      epoch = Date.now();
      try {
        await set(ref(db, `${ADMIN_CONFIG_PATH}/updatedAt`), epoch);
      } catch (e) {}
    }
    return {
      valid: true,
      adminId: config.adminId,
      authEpoch: epoch
    };
  }

  return { valid: false };
}

/**
 * Update Admin ID and Password in Firebase RTDB.
 * Changes the updatedAt/authEpoch timestamp, which immediately revokes
 * all active sessions on all devices!
 */
export async function updateAdminConfig(newAdminId, newAdminPass) {
  if (!newAdminId || !newAdminPass) {
    throw new Error("Admin ID and Password cannot be empty.");
  }
  const cleanId = newAdminId.trim();
  const cleanPass = String(newAdminPass).trim();
  const changeTimestamp = Date.now();

  await set(ref(db, ADMIN_CONFIG_PATH), {
    adminId: cleanId,
    adminPass: cleanPass,
    updatedAt: changeTimestamp
  });

  // Clear current device session as well so all devices must re-login
  clearSession();
  return { success: true, timestamp: changeTimestamp };
}

/**
 * Save authentication session to localStorage and sessionStorage
 */
export function saveSession(adminId, authEpoch) {
  if (typeof window === "undefined") return;
  const sessionData = {
    adminId: adminId,
    authEpoch: authEpoch || Date.now(),
    loginTime: Date.now()
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.error("Failed to store session:", e);
  }
}

/**
 * Get currently stored session object or null
 */
export function getStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Validate current active session.
 * If currentConfig is supplied, verifies session was created AFTER the last password change.
 * Returns { valid: true, adminId } or { valid: false, reason }.
 */
export function checkSession(currentConfig) {
  const session = getStoredSession();
  if (!session) return { valid: false };

  const now = Date.now();
  if (!session.loginTime || now - session.loginTime > SESSION_TIMEOUT_MS) {
    clearSession();
    return { valid: false, reason: "expired" };
  }

  // If password was updated in Firebase after this session was generated, session is invalid
  if (currentConfig && currentConfig.updatedAt) {
    if (!session.authEpoch || session.authEpoch < currentConfig.updatedAt) {
      clearSession();
      return { valid: false, reason: "password_changed" };
    }
  }

  return { valid: true, adminId: session.adminId, authEpoch: session.authEpoch };
}

/**
 * Clear session upon logout
 */
export function clearSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}
