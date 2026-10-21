import { describe, expect, it } from "vitest";
import { ApiError, normalizeError, tauriApi } from "./tauri";

describe("fronteira desktop e erros", () => {
  it("não cria banco de demonstração quando o núcleo não está disponível", async () => {
    await expect(tauriApi.authStatus()).rejects.toMatchObject({
      code: "DESKTOP_REQUIRED",
    });
  });
  it("preserva erro tipado e oculta erros internos desconhecidos", () => {
    expect(
      normalizeError({ code: "LOCKED", message: "Bloqueado" }),
    ).toMatchObject({ code: "LOCKED", message: "Bloqueado" });
    const error = new ApiError("VALIDATION", "Inválido");
    expect(normalizeError(error)).toBe(error);
    expect(normalizeError("senha/token/caminho interno").message).not.toContain(
      "senha/token",
    );
  });
});
