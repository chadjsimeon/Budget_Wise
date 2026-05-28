import { useEffect, useState } from "react";
import { getPendingSyncCount, subscribeSyncQueue } from "@/lib/syncQueue";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pendingSync, setPendingSync] = useState(getPendingSyncCount());

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const unsubscribe = subscribeSyncQueue(setPendingSync);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsubscribe();
    };
  }, []);

  return { isOnline, pendingSync };
}
