import { useWallet } from "@/lib/wallet";

export function useAuth() {
  const { address, connect, disconnect, isConnecting, error } = useWallet();
  return {
    isLoggedIn: !!address,
    address,
    isConnecting,
    error,
    login: connect,
    logout: disconnect,
  };
}
