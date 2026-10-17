import { ref, get, set } from "firebase/database";
import { db } from "./firebase";

const ADMIN_CONFIG_PATH = "admin_config";
const SESSION_KEY = "lexxa_admin_session";
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours of validity

// Default fallback credentials if none exist in Firebase yet
const DEFAULT_CREDENTIALS = {
  adminId: "admin",
  adminPass: "admin123"
};

/**
 * Fetch current admin credentials from Firebase RTDB.
 * If not yet initialized, returns default credentials.
 */
export async function getAdminConfig() {
  try {
    const snapshot = await get(ref(db, ADMIN_CONFIG_PATH));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        adminId: data.adminId || DEFAULT_CREDENTIALS.adminId,
        adminPass: data.adminPass || DEFAULT_CREDENTIALS.adminPass,
        updatedAt: data.updatedAt || null
      };
    } else {
      // First time initialization in Firebase
      await set(ref(db, ADMIN_CONFIG_PATH), {
        adminId: DEFAULT_CREDENTIALS.adminId,
        adminPass: DEFAULT_CREDENTIALS.adminPass,
        updatedAt: Date.now()
      });
      return DEFAULT_CREDENTIALS;
    }
  } catch (error) {
    console.warn("Could not reach Firebase for admin_config, using fallback:", error);
    return DEFAULT_CREDENTIALS;
  }
}

/**
 * Verify provided admin credentials against Firebase RTDB.
 */
export async function verifyAdminCredentials(inputAdminId, inputPassword) {
  if (!inputAdminId || !inputPassword) return false;
  const config = await getAdminConfig();
  const idMatch = config.adminId.trim().toLowerCase() === inputAdminId.trim().toLowerCase();
  const passMatch = String(config.adminPass) === String(inputPassword);
  return idMatch && passMatch;
}

/**
 * Update Admin ID and Password in Firebase RTDB.
 */
export async function updateAdminConfig(newAdminId, newAdminPass) {
  if (!newAdminId || !newAdminPass) {
    throw new Error("Admin ID and Password cannot be empty.");
  }
  const cleanId = newAdminId.trim();
  const cleanPass = String(newAdminPass).trim();

  await set(ref(db, ADMIN_CONFIG_PATH), {
    adminId: cleanId,
    adminPass: cleanPass,
    updatedAt: Date.now()
  });

  // Refresh active session
  saveSession(cleanId);
  return true;
}

/**
 * Save authentication session to localStorage and sessionStorage
 */
export function saveSession(adminId) {
  if (typeof window === "undefined") return;
  const sessionData = {
    adminId: adminId,
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
 * Validate current active session.
 * Returns { valid: true, adminId } or { valid: false }.
 */
export function checkSession() {
  if (typeof window === "undefined") return { valid: false };
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return { valid: false };

    const data = JSON.parse(raw);
    const now = Date.now();
    if (!data.loginTime || now - data.loginTime > SESSION_TIMEOUT_MS) {
      clearSession();
      return { valid: false, expired: true };
    }

    return { valid: true, adminId: data.adminId };
  } catch (e) {
    return { valid: false };
  }
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
