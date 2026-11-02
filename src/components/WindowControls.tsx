import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { command } from "../services/tauri";
export function WindowControls() {
  const [fullscreen, setFullscreen] = useState(true),
    [error, setError] = useState("");
  const current = useRef(true),
    pending = useRef(false);
  const setMode = useCallback(async (enabled: boolean) => {
    if (pending.current) return;
    pending.current = true;
    try {
      const value = await command<boolean>("window_fullscreen", { enabled });
      current.current = value;
      setFullscreen(value);
      setError("");
    } catch {
      setError(
        "Não foi possível mudar a janela. Use Alt+F4 para fechar o aplicativo.",
      );
    } finally {
      pending.current = false;
    }
  }, []);
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void command<boolean>("window_fullscreen", { enabled: null })
      .then((value) => {
        if (active) {
          current.current = value;
          setFullscreen(value);
        }
      })
      .catch(() => {});
    const key = (event: KeyboardEvent) => {
      if (event.key === "F11") {
        event.preventDefault();
        void setMode(!current.current);
      } else if (
        event.key === "Escape" &&
        current.current &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        void setMode(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      active = false;
      window.removeEventListener("keydown", key);
    };
  }, [setMode]);
  if (!isTauri()) return null;
  return (
    <div className="window-controls">
      <button
        className="button secondary"
        onClick={() => void setMode(!fullscreen)}
        title="F11 alterna; Esc sai da tela cheia"
      >
        {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
        <kbd>F11</kbd>
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
