import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const secureKey = async (key: string) => `deepgym.${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key)}`;

/** Store credentials in Keychain/Keystore. Profile metadata is loaded from the
 * authenticated API and is omitted here to stay below native item-size limits. */
export const credentialStorage = {
  async getItem(key: string): Promise<string | null> {
    return Platform.OS === "web" ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(await secureKey(key));
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
    let compact = value;
    if (!key.endsWith(":pkce")) {
      const session = JSON.parse(value);
      compact = JSON.stringify({
        access_token: session.access_token, refresh_token: session.refresh_token,
        expires_at: session.expires_at, expires_in: session.expires_in, token_type: session.token_type,
        user: { id: session.user.id, aud: session.user.aud, created_at: session.user.created_at, user_metadata: {}, app_metadata: {} },
      });
    }
    await SecureStore.setItemAsync(await secureKey(key), compact);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") return AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(await secureKey(key));
  },
};
