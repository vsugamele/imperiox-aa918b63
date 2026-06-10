/**
 * send-window.ts — Janela de horário permitida para automações
 *
 * Evita enviar mensagens de madrugada ou em horários ruins.
 * Usa o DDD do telefone BR para ajustar o fuso horário local do lead.
 *
 * Janela padrão: 08:00 – 21:00 no horário do lead.
 */

/** Retorna o offset UTC (horas) baseado no DDD brasileiro. */
function getTimezoneOffsetByPhone(phone: string): number {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits.startsWith("55") || digits.length < 4) return -3; // Brasília default
  const ddd = parseInt(digits.substring(2, 4));
  if (ddd === 68) return -5; // Acre
  if ([92, 97, 69, 95, 67, 65, 66].includes(ddd)) return -4; // Amazonas, MT, etc
  return -3; // Restante do Brasil
}

/**
 * Verifica se o horário atual está dentro da janela permitida
 * para o lead com o telefone informado.
 *
 * @param phone   Telefone do lead (com ou sem 55)
 * @param startH  Hora de início (padrão: 8)
 * @param endH    Hora de fim exclusiva (padrão: 21)
 */
export function isWithinSendWindow(
  phone: string,
  startH = 8,
  endH = 21,
): boolean {
  const offsetHours = getTimezoneOffsetByPhone(phone);
  const nowUtcMs = Date.now();
  const localMs = nowUtcMs + offsetHours * 3_600_000;
  const localDate = new Date(localMs);
  const localHour = localDate.getUTCHours(); // UTC after manual offset shift
  return localHour >= startH && localHour < endH;
}

/**
 * Retorna quantos minutos faltam para a janela abrir,
 * útil para log/debug.
 */
export function minutesUntilWindowOpens(phone: string, startH = 8): number {
  const offsetHours = getTimezoneOffsetByPhone(phone);
  const nowUtcMs = Date.now();
  const localMs = nowUtcMs + offsetHours * 3_600_000;
  const localDate = new Date(localMs);
  const localHour = localDate.getUTCHours();
  const localMin = localDate.getUTCMinutes();

  if (localHour >= startH) return 0;
  return (startH - localHour) * 60 - localMin;
}
