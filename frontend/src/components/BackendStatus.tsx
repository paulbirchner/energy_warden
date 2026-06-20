import { useEffect, useState } from "react";
import { getHealth } from "../api/energyWardenApi";

type Status = "loading" | "online" | "offline";

/** Zeigt den Erreichbarkeitsstatus des vorhandenen Backends an. */
export function BackendStatus() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getHealth()
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  if (status === "loading") {
    return <p>Backend-Status: wird geprüft...</p>;
  }

  if (status === "offline") {
    return <p>Backend-Status: nicht erreichbar</p>;
  }

  return <p>Backend-Status: online</p>;
}
