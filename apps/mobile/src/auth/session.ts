import * as SecureStore from "expo-secure-store";

const KEY = "tatakae.session";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

/** POST /api/session/login { email, password, client: "mobile", deviceName } → { token, expiresAt } */
export async function login(email: string, password: string, deviceName: string): Promise<void> {
  // TODO(phase0)
}

export async function logout(): Promise<void> {
  // TODO(phase0): POST /api/session/logout, then delete token
  await SecureStore.deleteItemAsync(KEY);
}
